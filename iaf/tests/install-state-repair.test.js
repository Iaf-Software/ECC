'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  analyzeInstallState,
  rebindInstallState,
  repairInstallState,
  ADAPTER_STATE_FILES,
} = require('../lib/install-state-repair');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function makeGitRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  spawnSync('git', ['init'], { cwd: root });
  git(root, ['config', 'user.email', 'fixture@example.com']);
  git(root, ['config', 'user.name', 'fixture']);
  git(root, ['remote', 'add', 'origin', 'https://github.com/example/future-product-fixture.git']);
  fs.writeFileSync(path.join(root, 'README.md'), 'fixture\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'init']);
  return root;
}

function writeManaged(root, rel, content) {
  const filePath = path.join(root, rel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return { filePath, sha: sha256(content) };
}

function makeState({ staleRoot, currentAdapterRoot, destRel, contentSha, extraOps = [] }) {
  const destOld = path.join(staleRoot, destRel);
  return {
    schemaVersion: 'ecc.install.v1',
    installedAt: '2026-09-20T00:00:00.000Z',
    target: {
      id: 'cursor-project',
      target: 'cursor',
      kind: 'project',
      root: staleRoot,
      installStatePath: path.join(staleRoot, 'ecc-install-state.json'),
    },
    request: {
      profile: 'minimal',
      modules: [],
      includeComponents: [],
      excludeComponents: [],
      legacyLanguages: [],
      legacyMode: false,
      hookConsent: 'declined',
    },
    resolution: { selectedModules: ['rules-core'], skippedModules: [] },
    source: { repoVersion: '2.2.2', repoCommit: 'abc123', manifestVersion: 1 },
    operations: [
      {
        kind: 'copy-file',
        moduleId: 'rules-core',
        sourcePath: '/opt/ecc/.cursor/rules/ecc-core.mdc',
        sourceRelativePath: '.cursor/rules/ecc-core.mdc',
        destinationPath: destOld,
        strategy: 'preserve-relative-path',
        ownership: 'managed',
        scaffoldOnly: false,
        contentSha256: contentSha,
      },
      ...extraOps,
    ],
  };
}

describe('install-state portability repair', () => {
  it('reports HEALTHY when recorded root already matches the current adapter', () => {
    const repo = makeGitRepo('iaf-state-healthy-');
    const managed = writeManaged(repo, '.cursor/rules/ecc-core.mdc', 'core-rule\n');
    const adapterRoot = path.join(repo, '.cursor');
    const state = makeState({
      staleRoot: adapterRoot,
      destRel: 'rules/ecc-core.mdc',
      contentSha: managed.sha,
    });
    const statePath = path.join(adapterRoot, 'ecc-install-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const analysis = analyzeInstallState({ projectRoot: repo, statePath });
    assert.equal(analysis.status, 'HEALTHY');
    assert.equal(analysis.repairable, false);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('proposes a rebind for stale worktree-root state when identity and files match', () => {
    const repo = makeGitRepo('iaf-state-stale-');
    const managed = writeManaged(repo, '.cursor/rules/ecc-core.mdc', 'core-rule\n');
    const staleRoot = path.join(os.tmpdir(), `iaf-old-worktree-${Date.now()}`, '.cursor');
    const adapterRoot = path.join(repo, '.cursor');
    const state = makeState({
      staleRoot,
      destRel: 'rules/ecc-core.mdc',
      contentSha: managed.sha,
    });
    const statePath = path.join(adapterRoot, 'ecc-install-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const analysis = analyzeInstallState({ projectRoot: repo, statePath });
    assert.equal(analysis.status, 'STALE_TARGET_ROOT');
    assert.equal(analysis.repairable, true);
    assert.equal(analysis.proposed.target.root, adapterRoot);
    assert.ok(analysis.proposed.operations[0].destinationPath.startsWith(adapterRoot));
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('refuses rebind when the stale root belongs to a different git repository', () => {
    const current = makeGitRepo('iaf-state-current-');
    const other = makeGitRepo('iaf-state-other-');
    git(other, ['remote', 'set-url', 'origin', 'https://github.com/example/other-fixture.git']);
    writeManaged(current, '.cursor/rules/ecc-core.mdc', 'core-rule\n');
    const otherManaged = writeManaged(other, '.cursor/rules/ecc-core.mdc', 'core-rule\n');
    const staleRoot = path.join(other, '.cursor');
    const adapterRoot = path.join(current, '.cursor');
    const state = makeState({
      staleRoot,
      destRel: 'rules/ecc-core.mdc',
      contentSha: otherManaged.sha,
    });
    const statePath = path.join(adapterRoot, 'ecc-install-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const analysis = analyzeInstallState({ projectRoot: current, statePath });
    assert.equal(analysis.status, 'REFUSED');
    assert.equal(analysis.repairable, false);
    assert.match(analysis.reason, /different repository/i);
    fs.rmSync(current, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  });

  it('refuses unexplained managed-file divergence', () => {
    const repo = makeGitRepo('iaf-state-div-');
    writeManaged(repo, '.cursor/rules/ecc-core.mdc', 'owner-edited\n');
    const staleRoot = path.join(os.tmpdir(), `iaf-missing-old-${Date.now()}`, '.cursor');
    const adapterRoot = path.join(repo, '.cursor');
    const state = makeState({
      staleRoot,
      destRel: 'rules/ecc-core.mdc',
      contentSha: sha256('original-managed\n'),
    });
    const statePath = path.join(adapterRoot, 'ecc-install-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const analysis = analyzeInstallState({ projectRoot: repo, statePath });
    assert.equal(analysis.status, 'REFUSED');
    assert.match(analysis.reason, /diverged/i);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('classifies IAF agent inherit transforms as expected, not unexplained edits', () => {
    const repo = makeGitRepo('iaf-state-iaf-');
    const agent = '---\nname: architect\nmodel: inherit\n# IAF_UPSTREAM_PREFERRED_MODEL: sonnet\n---\nrole\n';
    writeManaged(repo, '.cursor/agents/ecc-architect.md', agent);
    const staleRoot = path.join(os.tmpdir(), `iaf-old-agent-${Date.now()}`, '.cursor');
    const adapterRoot = path.join(repo, '.cursor');
    const state = makeState({
      staleRoot,
      destRel: 'agents/ecc-architect.md',
      contentSha: sha256('---\nname: architect\nmodel: sonnet\n---\nrole\n'),
    });
    const statePath = path.join(adapterRoot, 'ecc-install-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const analysis = analyzeInstallState({ projectRoot: repo, statePath });
    assert.equal(analysis.repairable, true);
    assert.equal(analysis.fileClasses[0].class, 'IAF_TRANSFORM');
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('refuses a missing managed file', () => {
    const repo = makeGitRepo('iaf-state-miss-');
    fs.mkdirSync(path.join(repo, '.cursor'), { recursive: true });
    const staleRoot = path.join(os.tmpdir(), `iaf-old-miss-${Date.now()}`, '.cursor');
    const adapterRoot = path.join(repo, '.cursor');
    const state = makeState({
      staleRoot,
      destRel: 'rules/ecc-core.mdc',
      contentSha: sha256('core-rule\n'),
    });
    const statePath = path.join(adapterRoot, 'ecc-install-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const analysis = analyzeInstallState({ projectRoot: repo, statePath });
    assert.equal(analysis.status, 'REFUSED');
    assert.match(analysis.reason, /missing/i);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('refuses malformed install-state', () => {
    const repo = makeGitRepo('iaf-state-bad-');
    const statePath = path.join(repo, '.cursor', 'ecc-install-state.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, '{not-json');
    const analysis = analyzeInstallState({ projectRoot: repo, statePath });
    assert.equal(analysis.status, 'REFUSED');
    assert.match(analysis.reason, /malformed/i);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('dry-run does not write; apply backups and rebinds absolute paths', () => {
    const repo = makeGitRepo('iaf-state-apply-');
    const managed = writeManaged(repo, '.cursor/rules/ecc-core.mdc', 'core-rule\n');
    const staleRoot = path.join(os.tmpdir(), `iaf-old-apply-${Date.now()}`, '.cursor');
    const adapterRoot = path.join(repo, '.cursor');
    const state = makeState({
      staleRoot,
      destRel: 'rules/ecc-core.mdc',
      contentSha: managed.sha,
    });
    const statePath = path.join(adapterRoot, 'ecc-install-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const dry = repairInstallState({ projectRoot: repo, statePath, dryRun: true });
    assert.equal(dry.applied, false);
    const stillStale = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(stillStale.target.root, staleRoot);
    const applied = repairInstallState({ projectRoot: repo, statePath, dryRun: false });
    assert.equal(applied.applied, true);
    const next = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(next.target.root, adapterRoot);
    assert.equal(next.target.installStatePath, statePath);
    assert.equal(next.operations[0].destinationPath, path.join(adapterRoot, 'rules/ecc-core.mdc'));
    assert.ok(fs.existsSync(applied.backupPath));
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('rebindInstallState is a pure transform of recorded prefixes', () => {
    const rebound = rebindInstallState(
      {
        target: { root: '/old/.cursor', installStatePath: '/old/.cursor/ecc-install-state.json' },
        operations: [{ destinationPath: '/old/.cursor/rules/a.mdc' }],
      },
      { fromPrefix: '/old/.cursor', toPrefix: '/new/.cursor' }
    );
    assert.equal(rebound.target.root, '/new/.cursor');
    assert.equal(rebound.operations[0].destinationPath, '/new/.cursor/rules/a.mdc');
  });

  it('exposes adapter state files without consumer names', () => {
    assert.ok(ADAPTER_STATE_FILES.some(item => item.relative.includes('.cursor/')));
    assert.ok(ADAPTER_STATE_FILES.some(item => item.adapterRoot === '.claude' && item.relative.includes('.claude/ecc/')));
    const blob = JSON.stringify(ADAPTER_STATE_FILES);
    assert.equal(/omnipos|optibuild|temasuite|bekeen/i.test(blob), false);
  });
});
