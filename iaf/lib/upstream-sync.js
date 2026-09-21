'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { eccRoot, loadPolicy } = require('./paths');
const { assertSafeGitArgs } = require('./git-safety');

function runGit(args, cwd = eccRoot()) {
  assertSafeGitArgs(args);
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    ok: result.status === 0,
  };
}

function previewUpstream() {
  const fetch = runGit(['fetch', 'upstream', 'main']);
  const local = runGit(['rev-parse', 'HEAD']);
  const upstream = runGit(['rev-parse', 'upstream/main']);
  const range = `${local.stdout}...${upstream.stdout}`;
  const log = runGit(['log', '--oneline', `${local.stdout}..${upstream.stdout}`]);
  const diffStat = runGit(['diff', '--stat', range]);
  const iafConflicts = detectIafOverlap(local.stdout, upstream.stdout);
  const retire = detectRetirableWorkarounds();
  return {
    ok: fetch.ok && local.ok && upstream.ok,
    fetch,
    local: local.stdout,
    upstream: upstream.stdout,
    commits: log.stdout,
    diffStat: diffStat.stdout,
    iafConflicts,
    retirable: retire,
    apply: 'git merge --no-ff upstream/main',
    rollback: 'git merge --abort (during merge) or git revert -m 1 <merge-commit> after publish; never force-push',
  };
}

function classifyChangedFiles(files) {
  const list = Array.isArray(files) ? files : [];
  const iafOwned = list.filter(file => file === 'iaf' || file.startsWith('iaf/'));
  return {
    upstreamTouchedIafTree: iafOwned,
    safe: iafOwned.length === 0,
  };
}

function detectIafOverlap(localSha, upstreamSha) {
  const changed = runGit(['diff', '--name-only', `${localSha}...${upstreamSha}`]);
  const files = changed.stdout ? changed.stdout.split('\n').filter(Boolean) : [];
  return classifyChangedFiles(files);
}

function detectRetirableWorkarounds(sourceRoot = eccRoot()) {
  const policy = loadPolicy('equivalent-upstream-features.json');
  const findings = [];
  const cursorHook = path.join(sourceRoot, '.cursor', 'hooks', 'adapter.js');
  if (fs.existsSync(cursorHook)) {
    const text = fs.readFileSync(cursorHook, 'utf8');
    const alreadyFixed = /path\.resolve\(__dirname,\s*['"]\.\.['"]\s*\)/.test(text)
      && !/path\.resolve\(__dirname,\s*['"]\.\.['"]\s*,\s*['"]\.\.['"]\s*\)/.test(text);
    findings.push({
      id: 'cursor-hook-path-compat',
      upstreamLooksEquivalent: alreadyFixed,
      action: alreadyFixed
        ? 'Retire IAF hook rewrite after verifying generated project copies'
        : 'Keep IAF hook rewrite',
    });
  }
  for (const feature of policy.features) {
    if (!findings.some(item => item.id === feature.id)) {
      findings.push({
        id: feature.id,
        upstreamLooksEquivalent: false,
        action: 'Keep IAF compatibility code until verified equivalent',
        detect: feature.detect,
      });
    }
  }
  return findings;
}

function applyUpstream(options = {}) {
  if (options.dryRun !== false && options.apply !== true) {
    return { ...previewUpstream(), applied: false, dryRun: true };
  }
  const preview = previewUpstream();
  if (!preview.iafConflicts.safe) {
    return { ...preview, applied: false, blocked: 'upstream would touch iaf/ tree' };
  }
  const merge = runGit(['merge', '--no-ff', 'upstream/main', '-m', 'chore(iaf): merge official ECC upstream/main']);
  return { ...preview, applied: merge.ok, merge };
}

module.exports = {
  previewUpstream,
  applyUpstream,
  detectIafOverlap,
  detectRetirableWorkarounds,
  classifyChangedFiles,
};
