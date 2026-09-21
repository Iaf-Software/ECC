'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { inspectRepo, githubSlugFromRemote } = require('./identity');

const ADAPTER_STATE_FILES = Object.freeze([
  { adapter: 'cursor', relative: '.cursor/ecc-install-state.json', adapterRoot: '.cursor' },
  { adapter: 'claude-project', relative: '.claude/ecc/install-state.json', adapterRoot: '.claude' },
  { adapter: 'claude-project-legacy', relative: '.claude/ecc-install-state.json', adapterRoot: '.claude' },
  { adapter: 'gemini', relative: '.gemini/ecc-install-state.json', adapterRoot: '.gemini' },
  { adapter: 'antigravity', relative: '.agents/ecc-install-state.json', adapterRoot: '.agents' },
]);

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function comparablePath(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function rebasePath(filePath, fromPrefix, toPrefix) {
  const resolved = path.resolve(filePath);
  const from = path.resolve(fromPrefix);
  const to = path.resolve(toPrefix);
  if (comparablePath(resolved) === comparablePath(from)) {
    return to;
  }
  const prefix = comparablePath(from) + path.sep;
  if (comparablePath(resolved).startsWith(prefix)) {
    return path.join(to, path.relative(from, resolved));
  }
  return filePath;
}

function gitTopLevel(startPath) {
  if (!startPath || !fs.existsSync(startPath)) {
    return null;
  }
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: startPath,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function classifyManagedContent(relPath, content, expectedSha, actualSha) {
  if (!actualSha) {
    return 'MISSING';
  }
  if (actualSha === expectedSha) {
    return 'MATCH';
  }
  const normalized = String(relPath || '').replace(/\\/g, '/');
  const text = String(content || '');
  if (
    /(?:^|\/)agents\/.+\.md$/.test(normalized)
    && /IAF_(UPSTREAM_)?PREFERRED_MODEL/.test(text)
  ) {
    return 'IAF_TRANSFORM';
  }
  if (
    /(?:^|\/)hooks\/.+\.js$/.test(normalized)
    && /require\((['"])\.\.\/scripts\//.test(text)
  ) {
    return 'IAF_TRANSFORM';
  }
  return 'DIVERGED';
}

function rebindInstallState(state, { fromPrefix, toPrefix }) {
  const next = JSON.parse(JSON.stringify(state));
  if (next.target) {
    if (next.target.root) {
      next.target.root = rebasePath(next.target.root, fromPrefix, toPrefix);
    }
    if (next.target.installStatePath) {
      next.target.installStatePath = rebasePath(next.target.installStatePath, fromPrefix, toPrefix);
    }
  }
  next.operations = (next.operations || []).map((operation) => {
    if (!operation || !operation.destinationPath) {
      return operation;
    }
    return {
      ...operation,
      destinationPath: rebasePath(operation.destinationPath, fromPrefix, toPrefix),
    };
  });
  return next;
}

function readStateFile(statePath) {
  try {
    return { ok: true, state: JSON.parse(fs.readFileSync(statePath, 'utf8')) };
  } catch (error) {
    return { ok: false, error };
  }
}

function analyzeInstallState(options = {}) {
  const projectRoot = path.resolve(options.projectRoot);
  const statePath = path.resolve(options.statePath);
  const parsed = readStateFile(statePath);
  if (!parsed.ok) {
    return {
      status: 'REFUSED',
      repairable: false,
      reason: 'malformed install-state JSON',
      statePath,
    };
  }
  const state = parsed.state;
  if (!state || !state.target || !state.target.root) {
    return {
      status: 'REFUSED',
      repairable: false,
      reason: 'malformed install-state: missing target.root',
      statePath,
    };
  }

  const currentAdapterRoot = path.resolve(
    options.currentAdapterRoot || path.dirname(statePath)
  );
  const recordedRoot = state.target.root;
  if (comparablePath(recordedRoot) === comparablePath(currentAdapterRoot)) {
    return {
      status: 'HEALTHY',
      repairable: false,
      reason: 'install-state target root already matches the current adapter',
      statePath,
      currentAdapterRoot,
      recordedRoot,
    };
  }

  const currentRepo = inspectRepo(projectRoot);
  const staleTop = gitTopLevel(recordedRoot);
  if (staleTop) {
    try {
      const staleRepo = inspectRepo(staleTop);
      const currentSlug = githubSlugFromRemote(currentRepo.origin);
      const staleSlug = githubSlugFromRemote(staleRepo.origin);
      if (currentSlug && staleSlug && currentSlug !== staleSlug) {
        return {
          status: 'REFUSED',
          repairable: false,
          reason: `stale root belongs to a different repository (${staleSlug} vs ${currentSlug})`,
          statePath,
        };
      }
    } catch {
      // Stale path exists but is not a git work tree; continue with file checks.
    }
  }

  const fileClasses = [];
  for (const operation of state.operations || []) {
    if (!operation || operation.kind !== 'copy-file' || !operation.destinationPath) {
      continue;
    }
    const relative = path.relative(recordedRoot, operation.destinationPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return {
        status: 'REFUSED',
        repairable: false,
        reason: `destinationPath is not under recorded root: ${operation.destinationPath}`,
        statePath,
      };
    }
    const currentFile = path.join(currentAdapterRoot, relative);
    const exists = fs.existsSync(currentFile);
    const actualSha = exists ? sha256File(currentFile) : null;
    const content = exists ? fs.readFileSync(currentFile, 'utf8') : '';
    const fileClass = classifyManagedContent(
      relative.replace(/\\/g, '/'),
      content,
      operation.contentSha256,
      actualSha
    );
    fileClasses.push({
      relative: relative.replace(/\\/g, '/'),
      class: fileClass,
      currentFile,
    });
  }

  if (fileClasses.some(item => item.class === 'MISSING')) {
    return {
      status: 'REFUSED',
      repairable: false,
      reason: 'missing managed file at current adapter root',
      fileClasses,
      statePath,
    };
  }
  if (fileClasses.some(item => item.class === 'DIVERGED')) {
    return {
      status: 'REFUSED',
      repairable: false,
      reason: 'unexplained diverged managed file; refusing silent path rewrite',
      fileClasses,
      statePath,
    };
  }

  const proposed = rebindInstallState(state, {
    fromPrefix: recordedRoot,
    toPrefix: currentAdapterRoot,
  });
  return {
    status: 'STALE_TARGET_ROOT',
    repairable: true,
    reason: 'recorded absolute target root does not match current checkout; files match or are IAF transforms',
    classification: 'BLOCKED_BY_STALE_INSTALL_STATE',
    statePath,
    recordedRoot,
    currentAdapterRoot,
    proposed,
    fileClasses,
    project: currentRepo,
  };
}

function backupState(statePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${statePath}.iaf-backup-${stamp}`;
  fs.copyFileSync(statePath, backupPath);
  return backupPath;
}

function repairInstallState(options = {}) {
  const analysis = analyzeInstallState(options);
  if (analysis.status === 'HEALTHY') {
    return { ...analysis, applied: false, dryRun: Boolean(options.dryRun) };
  }
  if (!analysis.repairable) {
    return { ...analysis, applied: false, dryRun: Boolean(options.dryRun) };
  }
  if (options.dryRun) {
    return { ...analysis, applied: false, dryRun: true };
  }
  const backupPath = backupState(options.statePath);
  fs.writeFileSync(options.statePath, `${JSON.stringify(analysis.proposed, null, 2)}\n`);
  return {
    ...analysis,
    applied: true,
    dryRun: false,
    backupPath,
  };
}

function discoverAdapterStates(projectRoot) {
  return ADAPTER_STATE_FILES
    .map(entry => ({
      ...entry,
      statePath: path.join(projectRoot, entry.relative),
    }))
    .filter(entry => fs.existsSync(entry.statePath));
}

function repairProjectInstallState(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || options.repo);
  const discovered = discoverAdapterStates(projectRoot);
  if (discovered.length === 0) {
    return {
      ok: true,
      projectRoot,
      results: [],
      reason: 'no install-state files found',
    };
  }
  const results = discovered.map(entry => ({
    adapter: entry.adapter,
    ...repairInstallState({
      projectRoot,
      statePath: entry.statePath,
      currentAdapterRoot: path.join(projectRoot, entry.adapterRoot),
      dryRun: options.dryRun,
    }),
  }));
  const repairable = results.filter(item => item.repairable);
  const refused = results.filter(item => item.status === 'REFUSED');
  const healthy = results.filter(item => item.status === 'HEALTHY');
  const appliedOk = repairable.every(item => item.applied || item.dryRun);
  return {
    ok: appliedOk && (repairable.length > 0 || healthy.length > 0),
    projectRoot,
    results,
    refused,
    overlayMode: repairable.length > 0
      ? 'BLOCKED_BY_STALE_INSTALL_STATE'
      : (refused.length > 0 ? 'TEMPORARY_DEGRADED' : null),
  };
}

module.exports = {
  ADAPTER_STATE_FILES,
  rebasePath,
  rebindInstallState,
  analyzeInstallState,
  repairInstallState,
  repairProjectInstallState,
  discoverAdapterStates,
  classifyManagedContent,
};
