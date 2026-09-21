'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadPolicy } = require('./paths');
const { inspectRepo, githubSlugFromRemote } = require('./identity');
const { readInstallState } = require('./provenance');
const { iafVersion } = require('./paths');

function existingHint(hints) {
  for (const hint of hints || []) {
    if (hint && fs.existsSync(hint)) {
      return hint;
    }
  }
  return null;
}

function doctorCursor(projectRoot) {
  const state = readInstallState(projectRoot, '.cursor');
  return state ? 'INSTALLED' : 'MISSING';
}

function statusOne(project) {
  const foundPath = existingHint(project.pathHints);
  const row = {
    PROJECT: project.id,
    PATH: foundPath || 'NOT_FOUND',
    REMOTE: null,
    BRANCH: null,
    HEAD: null,
    DIRTY: null,
    ECC_OFFICIAL_VERSION: null,
    ECC_UPSTREAM_SHA: null,
    IAF_ECC_VERSION: null,
    IAF_ECC_SHA: null,
    CURSOR: 'MISSING',
    CLAUDE: 'MISSING',
    CODEX: 'NOT_PROJECT_LOCAL',
    GEMINI: 'MISSING',
    ANTIGRAVITY: 'MISSING',
    HOOK_STATUS: 'unknown',
    ROUTING_POLICY: 'missing',
    MODEL_ROUTING_POLICY: 'missing',
    DOCTOR: 'NOT_RUN',
    UPDATE_AVAILABLE: 'unknown',
    ACTION_REQUIRED: foundPath ? 'none' : 'checkout-not-found',
    LIVE_EXPECTED: project.liveExpected,
  };
  if (!foundPath) {
    return row;
  }
  try {
    const info = inspectRepo(foundPath);
    row.REMOTE = info.origin;
    row.BRANCH = info.branch;
    row.HEAD = info.head;
    row.DIRTY = info.dirty ? 'DIRTY' : 'CLEAN';
    row.GITHUB = githubSlugFromRemote(info.origin);
  } catch (error) {
    row.ACTION_REQUIRED = error.code || error.message;
    return row;
  }
  const cursorState = readInstallState(foundPath, '.cursor');
  if (cursorState && cursorState.source) {
    row.ECC_OFFICIAL_VERSION = cursorState.source.repoVersion;
    row.ECC_UPSTREAM_SHA = cursorState.source.repoCommit;
    row.CURSOR = 'INSTALLED';
  }
  if (readInstallState(foundPath, '.claude')) {
    row.CLAUDE = 'INSTALLED';
  }
  if (readInstallState(foundPath, '.gemini')) {
    row.GEMINI = 'INSTALLED';
  }
  if (readInstallState(foundPath, '.agents')) {
    row.ANTIGRAVITY = 'INSTALLED';
  }
  if (fs.existsSync(path.join(foundPath, '.cursor', 'hooks.json'))) {
    row.HOOK_STATUS = 'present';
  } else {
    row.HOOK_STATUS = 'absent';
  }
  if (fs.existsSync(path.join(foundPath, '.cursor', 'rules', 'iaf-autonomous-orchestration.mdc'))) {
    row.ROUTING_POLICY = 'installed';
  }
  if (fs.existsSync(path.join(foundPath, '.cursor', 'rules', 'iaf-model-routing.mdc'))
    || fs.existsSync(path.join(foundPath, '.cursor', 'iaf', 'model-routing.json'))) {
    row.MODEL_ROUTING_POLICY = 'installed';
  }
  const iafStatePath = path.join(foundPath, '.iaf-ecc-state.json');
  if (fs.existsSync(iafStatePath)) {
    const iafState = JSON.parse(fs.readFileSync(iafStatePath, 'utf8'));
    row.IAF_ECC_VERSION = iafState.iafExtensionVersion;
    row.IAF_ECC_SHA = iafState.iafForkCommit;
  } else {
    row.IAF_ECC_VERSION = 'not-adapted';
    row.ACTION_REQUIRED = 'adapt';
  }
  row.CURRENT_IAF_BUNDLE = iafVersion();
  return row;
}

function fleetStatus() {
  const fleet = loadPolicy('fleet.json');
  return fleet.projects.map(statusOne);
}

function fleetUpdate(options = {}) {
  if (options.all === true) {
    const error = new Error('Refusing concurrent fleet mutation. Pass --repo <id> to update one repository.');
    error.code = 'IAF_FLEET_SERIAL_REQUIRED';
    throw error;
  }
  const fleet = loadPolicy('fleet.json');
  const project = fleet.projects.find(item => item.id === options.repo);
  if (!project) {
    const error = new Error(`Unknown fleet repo: ${options.repo}`);
    error.code = 'IAF_UNKNOWN_REPO';
    throw error;
  }
  const foundPath = existingHint(project.pathHints);
  if (!foundPath) {
    return { ok: false, skipped: true, reason: 'checkout-not-found', project: project.id };
  }
  const { updateRepo } = require('./adapt');
  return updateRepo({
    repo: foundPath,
    github: project.github,
    dryRun: options.dryRun,
    harnesses: options.harnesses,
    hooks: options.hooks,
  });
}

function parseLsRemote(github, branch) {
  const result = spawnSync('git', ['ls-remote', '--heads', `https://github.com/${github}.git`, branch], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  const line = (result.stdout || '').trim().split('\n')[0] || '';
  return line.split(/[\s\t]/)[0] || null;
}

module.exports = {
  fleetStatus,
  fleetUpdate,
  statusOne,
  parseLsRemote,
};
