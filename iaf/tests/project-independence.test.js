'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { adaptRepo, bootstrapRepo, updateRepo } = require('../lib/adapt');
const { fleetStatus, fleetUpdate } = require('../lib/fleet');
const { resolveModel } = require('../lib/model-routing');
const { discoverProjectContext } = require('../lib/project-context');
const { officialInstall } = require('../lib/official-install');

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function makeRepo(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  spawnSync('git', ['init'], { cwd: root });
  git(root, ['config', 'user.email', 'fixture@example.com']);
  git(root, ['config', 'user.name', 'fixture']);
  fs.mkdirSync(path.join(root, 'docs', 'architecture'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), `# ${name}\n`);
  fs.writeFileSync(path.join(root, 'docs', 'architecture', 'NOTES.md'), 'generic architecture note\n');
  git(root, ['add', 'README.md', 'docs/architecture/NOTES.md']);
  git(root, ['commit', '-m', 'init']);
  return root;
}

describe('project independence', () => {
  it('discovers project docs from fixture content, not hardcoded consumer filenames', () => {
    const root = makeRepo('fixture-alpha');
    const discovered = discoverProjectContext(root);
    assert.ok(discovered.architectureFiles.some(file => file.endsWith('NOTES.md')));
    assert.equal(discovered.present.includes('docs/architecture'), true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('bootstraps a previously unknown repository without editing IAF source', () => {
    const root = makeRepo('fixture-alpha');
    const dry = bootstrapRepo({ repo: root, dryRun: true, harnesses: ['cursor'] });
    assert.equal(dry.ok, true);
    const result = bootstrapRepo({
      repo: root,
      dryRun: false,
      harnesses: ['cursor'],
      hooks: 'off',
      profile: 'minimal',
      requireClean: false,
    });
    assert.equal(result.ok, true, JSON.stringify(result.results || result, null, 2).slice(0, 500));
    assert.equal(fs.existsSync(path.join(root, '.iaf-ecc-state.json')), true);
    assert.equal(fs.existsSync(path.join(root, '.cursor', 'rules', 'iaf-autonomous-orchestration.mdc')), true);
    const agent = fs.readFileSync(path.join(root, '.cursor', 'agents', 'ecc-architect.md'), 'utf8');
    assert.match(agent, /model: inherit/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('adapts and updates another unknown repository by path', () => {
    const root = makeRepo('fixture-beta');
    const adapted = adaptRepo({
      repo: root,
      dryRun: false,
      harnesses: ['gemini'],
      hooks: 'off',
      profile: 'minimal',
      allowDirty: true,
    });
    assert.equal(adapted.ok, true);
    const updated = updateRepo({
      repo: root,
      dryRun: false,
      harnesses: ['gemini'],
      hooks: 'off',
      profile: 'minimal',
    });
    assert.equal(updated.ok, true);
    assert.equal(fs.existsSync(path.join(root, '.gemini', 'iaf-orchestration.md')), true);
    const byPath = fleetUpdate({ repo: root, dryRun: true });
    assert.equal(byPath.dryRun, true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('accepts a new fleet member through inventory data only', () => {
    const alpha = makeRepo('fixture-alpha');
    const inventoryPath = path.join(alpha, 'inventory.json');
    fs.writeFileSync(inventoryPath, JSON.stringify({
      classification: 'IAF_FLEET_DATA',
      projects: [{ id: 'fixture-alpha', pathHints: [alpha], liveExpected: 'no' }],
    }));
    const rows = fleetStatus({ inventoryPath });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].PROJECT, 'fixture-alpha');
    assert.equal(rows[0].PATH, alpha);
    fs.rmSync(alpha, { recursive: true, force: true });
  });

  it('model routing ignores repository identity', () => {
    const a = resolveModel({
      harness: 'cursor',
      specialist: { role: 'architect' },
      preferred: 'sonnet',
      inheritUsable: true,
      availableModels: [],
    });
    const b = resolveModel({
      harness: 'cursor',
      specialist: { role: 'architect' },
      preferred: 'sonnet',
      inheritUsable: true,
      availableModels: [],
      repository: 'future-unknown-repo',
    });
    assert.equal(a.selected, b.selected);
    assert.equal(a.specialistRole, 'architect');
    assert.equal(officialInstall.length >= 0, true);
  });
});
