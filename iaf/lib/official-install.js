'use strict';

const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');
const { eccRoot } = require('./paths');

const PROJECT_TARGETS = ['cursor', 'claude-project', 'gemini', 'antigravity'];
const HOME_TARGETS = ['claude', 'codex'];

function profileIncludesHooksRuntime(profile, root = eccRoot()) {
  const filePath = path.join(root, 'manifests', 'install-profiles.json');
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const profiles = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const modules = (((profiles.profiles || {})[profile] || {}).modules) || [];
  return modules.includes('hooks-runtime');
}

function hookOptInArgs(profile, hooks) {
  if (hooks === false || hooks === 'off') {
    return [];
  }
  if (hooks === true || hooks === 'on') {
    if (!profileIncludesHooksRuntime(profile || 'developer')) {
      return ['--with', 'baseline:hooks'];
    }
  }
  return [];
}

function resolveNodeModules(root) {
  const local = path.join(root, 'node_modules');
  if (fs.existsSync(path.join(local, 'sql.js')) || fs.existsSync(local)) {
    if (fs.existsSync(path.join(local, 'sql.js'))) {
      return local;
    }
  }
  const gitCommon = spawnSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (gitCommon.status === 0) {
    const common = path.resolve(root, gitCommon.stdout.trim());
    const mainRoot = path.basename(common) === '.git' ? path.dirname(common) : common;
    const candidate = path.join(mainRoot, 'node_modules');
    if (fs.existsSync(path.join(candidate, 'sql.js'))) {
      return candidate;
    }
  }
  return fs.existsSync(local) ? local : null;
}

function officialInstall({ target, projectRoot, profile, dryRun, hooks, extraArgs = [] }) {
  const root = eccRoot();
  const installer = path.join(root, 'scripts', 'install-apply.js');
  const args = [installer, '--target', target, '--profile', profile || 'developer'];
  if (dryRun) {
    args.push('--dry-run');
  }
  if (hooks === false || hooks === 'off') {
    args.push('--no-hooks');
  } else if (hooks === true || hooks === 'on') {
    args.push('--enable-hooks');
  }
  args.push(...hookOptInArgs(profile, hooks));
  args.push(...extraArgs);

  const nodeModules = resolveNodeModules(root);
  const env = {
    ...process.env,
    ECC_DISABLED_MCPS: process.env.ECC_DISABLED_MCPS || 'chrome-devtools',
  };
  if (nodeModules) {
    env.NODE_PATH = [nodeModules, env.NODE_PATH].filter(Boolean).join(path.delimiter);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env,
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    ok: result.status === 0,
    target,
    projectRoot,
    dryRun: Boolean(dryRun),
    nodeModules,
  };
}

function defaultTargets() {
  return ['cursor', 'claude-project', 'gemini', 'antigravity'];
}

module.exports = {
  officialInstall,
  defaultTargets,
  resolveNodeModules,
  PROJECT_TARGETS,
  HOME_TARGETS,
  profileIncludesHooksRuntime,
  hookOptInArgs,
};
