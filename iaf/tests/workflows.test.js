'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { adaptRepo } = require('../lib/adapt');
const { fleetStatus } = require('../lib/fleet');
const { detectIafOverlap, detectRetirableWorkarounds } = require('../lib/upstream-sync');
const { applyCursorAgentModelTransform, installPolicyTemplates } = require('../lib/overlay');

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

describe('overlay and workflows', () => {
  it('bootstrap/adapt dry-run does not write', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-adapt-'));
    spawnSync('git', ['init'], { cwd: root });
    git(root, ['config', 'user.email', 'test@example.com']);
    git(root, ['config', 'user.name', 'test']);
    fs.writeFileSync(path.join(root, 'README.md'), 'fixture\n');
    git(root, ['add', 'README.md']);
    git(root, ['commit', '-m', 'init']);
    const result = adaptRepo({ repo: root, dryRun: true, harnesses: ['cursor'] });
    assert.equal(result.dryRun, true);
    assert.equal(fs.existsSync(path.join(root, '.iaf-ecc-state.json')), false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('installs IAF templates and transforms generated Cursor agents without touching upstream agents/', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-overlay-'));
    const agentPath = path.join(root, '.cursor', 'agents', 'ecc-architect.md');
    fs.mkdirSync(path.dirname(agentPath), { recursive: true });
    fs.writeFileSync(agentPath, '---\nname: architect\nmodel: sonnet\n---\nrole body\n');
    const installed = installPolicyTemplates(root, ['cursor', 'gemini']);
    const changed = applyCursorAgentModelTransform(root);
    assert.ok(installed.includes('.cursor/rules/iaf-autonomous-orchestration.mdc'));
    assert.ok(fs.existsSync(path.join(root, '.gemini', 'iaf-orchestration.md')));
    assert.ok(changed.length > 0);
    const generated = fs.readFileSync(agentPath, 'utf8');
    assert.match(generated, /model: inherit/);
    const upstreamAgent = fs.readFileSync(path.join(__dirname, '..', '..', 'agents', 'architect.md'), 'utf8');
    assert.match(upstreamAgent, /^model: (sonnet|opus|haiku)$/m);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('fleet status uses supplied inventory and serial update refuses --all', () => {
    const inventoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-inv-'));
    const inventoryPath = path.join(inventoryDir, 'fleet.inventory.json');
    fs.writeFileSync(inventoryPath, JSON.stringify({
      classification: 'IAF_FLEET_DATA',
      projects: [{ id: 'fixture-alpha', pathHints: [inventoryDir], liveExpected: 'no' }],
    }));
    const rows = fleetStatus({ inventoryPath });
    assert.ok(Array.isArray(rows));
    assert.ok(rows.some(row => row.PROJECT === 'fixture-alpha'));
    const { fleetUpdate } = require('../lib/fleet');
    assert.throws(() => fleetUpdate({ all: true }), /concurrent fleet mutation/);
    fs.rmSync(inventoryDir, { recursive: true, force: true });
  });

  it('skips official reinstall on install-state target mismatch when adapters exist', () => {
    const { isInstallStateTargetMismatch } = require('../lib/adapt');
    assert.equal(isInstallStateTargetMismatch({
      stderr: 'Error: Refusing install: install-state target does not match the current plan at /tmp/fixture/.cursor/ecc-install-state.json.',
    }), true);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-overlay-only-'));
    spawnSync('git', ['init'], { cwd: root });
    git(root, ['config', 'user.email', 'test@example.com']);
    git(root, ['config', 'user.name', 'test']);
    fs.writeFileSync(path.join(root, 'README.md'), 'fixture\n');
    git(root, ['add', 'README.md']);
    git(root, ['commit', '-m', 'init']);
    const result = adaptRepo({
      repo: root,
      dryRun: false,
      harnesses: ['cursor'],
      overlayOnly: true,
      allowDirty: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.overlayOnly, true);
    assert.equal(fs.existsSync(path.join(root, '.cursor', 'rules', 'iaf-autonomous-orchestration.mdc')), true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('upstream overlap detector treats iaf/ as IAF-owned', () => {
    const overlap = detectIafOverlap('HEAD', 'HEAD');
    assert.equal(overlap.safe, true);
    const retire = detectRetirableWorkarounds();
    assert.ok(retire.some(item => item.id === 'cursor-hook-path-compat'));
    assert.equal(retire.find(item => item.id === 'cursor-hook-path-compat').upstreamLooksEquivalent, false);
  });
});
