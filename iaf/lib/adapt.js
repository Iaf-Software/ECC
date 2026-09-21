'use strict';

const fs = require('fs');
const path = require('path');
const { inspectRepo, assertExpectedRemote } = require('./identity');
const { classifyDirtyPath } = require('./git-safety');
const { officialInstall, defaultTargets } = require('./official-install');
const {
  applyCursorHookCompat,
  applyCursorAgentModelTransform,
  installPolicyTemplates,
  detectHookCollision,
} = require('./overlay');
const { buildProvenance, writeProvenance } = require('./provenance');
const { discoverProjectContext } = require('./project-context');
const { repairProjectInstallState } = require('./install-state-repair');

const PRESERVE_NAMES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'docs',
]);

function classifyExisting(projectRoot) {
  const info = inspectRepo(projectRoot);
  const dirtyFiles = info.porcelain
    ? info.porcelain.split('\n').filter(Boolean).map(line => ({
      code: line.slice(0, 2).trim(),
      path: line.slice(3),
      class: classifyDirtyPath(line.slice(3)),
    }))
    : [];
  return { ...info, dirtyFiles };
}

function installerOutput(result) {
  return `${result && result.stderr ? result.stderr : ''}\n${result && result.stdout ? result.stdout : ''}`;
}

function isInstallStateTargetMismatch(result) {
  return /install-state target does not match the current plan/.test(installerOutput(result));
}

function adapterStatePath(target) {
  const map = {
    cursor: ['.cursor/ecc-install-state.json'],
    'claude-project': ['.claude/ecc-install-state.json', '.claude/ecc/install-state.json'],
    gemini: ['.gemini/ecc-install-state.json'],
    antigravity: ['.agents/ecc-install-state.json'],
    claude: [],
    codex: [],
  };
  return map[target] || [];
}

function hasExistingAdapter(projectRoot, target) {
  return adapterStatePath(target).some(relativePath => fs.existsSync(path.join(projectRoot, relativePath)));
}

function shouldSkipHooks(projectRoot, hooksMode) {
  if (hooksMode === 'off') {
    return { skip: true, reason: 'requested off' };
  }
  const collision = detectHookCollision(projectRoot);
  if (collision.collision && hooksMode !== 'on') {
    return { skip: true, reason: 'hook collision', collision };
  }
  return { skip: false, collision };
}

function adaptRepo(options) {
  const projectRoot = path.resolve(options.repo);
  const expectedGithub = options.github || null;
  const info = expectedGithub
    ? assertExpectedRemote(projectRoot, expectedGithub)
    : inspectRepo(projectRoot);
  if (options.requireClean && info.dirty && !options.allowDirty) {
    const error = new Error(`Working tree is dirty; refusing to overwrite unexplained owner work: ${projectRoot}`);
    error.code = 'IAF_DIRTY_TREE';
    throw error;
  }

  const harnesses = options.harnesses || defaultTargets();
  const profile = options.profile || 'developer';
  const dryRun = Boolean(options.dryRun);
  const hookDecision = shouldSkipHooks(projectRoot, options.hooks || 'auto');
  const results = [];

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      project: info,
      harnesses,
      hooks: hookDecision,
      preserve: [...PRESERVE_NAMES],
      projectContext: discoverProjectContext(projectRoot),
      wouldInstallOfficial: harnesses,
      wouldApplyIafOverlay: true,
    };
  }

  for (const target of harnesses) {
    if (options.overlayOnly) {
      results.push({
        target,
        ok: true,
        skippedOfficial: true,
        reason: 'overlay-only',
        overlayOnly: true,
        overlayMode: 'TEMPORARY_DEGRADED',
      });
      continue;
    }
    const installed = officialInstall({
      target,
      projectRoot,
      profile,
      dryRun: false,
      hooks: target === 'cursor' && !hookDecision.skip,
    });
    if (!installed.ok && isInstallStateTargetMismatch(installed)) {
      if (options.overlayOnly) {
        results.push({
          ...installed,
          ok: true,
          skippedOfficial: true,
          reason: 'overlay-only',
          overlayOnly: true,
          overlayMode: 'TEMPORARY_DEGRADED',
          adapterPresent: hasExistingAdapter(projectRoot, target),
        });
        continue;
      }
      const repaired = repairProjectInstallState({
        projectRoot,
        dryRun: false,
      });
      if (repaired.ok && repaired.results.some(item => item.applied)) {
        const retried = officialInstall({
          target,
          projectRoot,
          profile,
          dryRun: false,
          hooks: target === 'cursor' && !hookDecision.skip,
        });
        results.push({
          ...retried,
          installStateRepaired: true,
          overlayMode: retried.ok ? 'OFFICIAL_PLUS_IAF' : 'TEMPORARY_DEGRADED',
        });
        if (!retried.ok) {
          return {
            ok: false,
            project: info,
            failedTarget: target,
            results,
            installStateRepair: repaired,
          };
        }
        continue;
      }
      results.push({
        ...installed,
        ok: true,
        skippedOfficial: true,
        reason: 'install-state-target-mismatch',
        overlayOnly: true,
        overlayMode: repaired.results.some(item => item.status === 'REFUSED')
          ? 'BLOCKED_BY_STALE_INSTALL_STATE'
          : 'TEMPORARY_DEGRADED',
        adapterPresent: hasExistingAdapter(projectRoot, target),
        installStateRepair: repaired,
      });
      continue;
    }
    results.push(installed);
    if (!installed.ok) {
      return {
        ok: false,
        project: info,
        failedTarget: target,
        results,
      };
    }
  }

  const overlay = {
    templates: installPolicyTemplates(projectRoot, harnesses),
    hookCompat: harnesses.includes('cursor') ? applyCursorHookCompat(projectRoot) : [],
    agentModels: harnesses.includes('cursor')
      ? applyCursorAgentModelTransform(projectRoot, {
        cursorUsePreferredModels: options.cursorUsePreferredModels === true,
      })
      : [],
  };

  const projectContext = discoverProjectContext(projectRoot);
  const provenance = buildProvenance({
    projectRoot,
    harnesses,
    profile,
    hooksEnabled: !hookDecision.skip,
    projectContext,
  });
  writeProvenance(projectRoot, provenance);

  const overlayMode = options.overlayOnly
    ? 'TEMPORARY_DEGRADED'
    : (results.some(item => item.overlayMode === 'BLOCKED_BY_STALE_INSTALL_STATE')
      ? 'BLOCKED_BY_STALE_INSTALL_STATE'
      : (results.some(item => item.overlayOnly || item.skippedOfficial)
        ? 'TEMPORARY_DEGRADED'
        : 'OFFICIAL_PLUS_IAF'));

  return {
    ok: results.every(item => item.ok),
    project: info,
    harnesses,
    hooks: hookDecision,
    results,
    overlay,
    overlayOnly: overlayMode !== 'OFFICIAL_PLUS_IAF',
    overlayMode,
    provenancePath: path.join(projectRoot, '.iaf-ecc-state.json'),
    projectContext,
    preserved: [...PRESERVE_NAMES].filter(name => fs.existsSync(path.join(projectRoot, name))),
  };
}

function bootstrapRepo(options) {
  return adaptRepo({ ...options, requireClean: options.requireClean !== false });
}

function updateRepo(options) {
  return adaptRepo({ ...options, requireClean: false, allowDirty: true });
}

module.exports = {
  classifyExisting,
  adaptRepo,
  bootstrapRepo,
  updateRepo,
  shouldSkipHooks,
  isInstallStateTargetMismatch,
  hasExistingAdapter,
};
