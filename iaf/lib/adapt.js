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
    cursor: '.cursor/ecc-install-state.json',
    'claude-project': '.claude/ecc-install-state.json',
    gemini: '.gemini/ecc-install-state.json',
    antigravity: '.agents/ecc-install-state.json',
    claude: null,
    codex: null,
  };
  return map[target] || null;
}

function hasExistingAdapter(projectRoot, target) {
  const relativePath = adapterStatePath(target);
  return Boolean(relativePath && fs.existsSync(path.join(projectRoot, relativePath)));
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
    if (!installed.ok && isInstallStateTargetMismatch(installed) && hasExistingAdapter(projectRoot, target)) {
      results.push({
        ...installed,
        ok: true,
        skippedOfficial: true,
        reason: 'install-state-target-mismatch',
        overlayOnly: true,
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

  return {
    ok: results.every(item => item.ok),
    project: info,
    harnesses,
    hooks: hookDecision,
    results,
    overlay,
    overlayOnly: Boolean(options.overlayOnly || results.some(item => item.overlayOnly || item.skippedOfficial)),
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
