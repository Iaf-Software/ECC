'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { eccRoot } = require('./paths');
const { resolveNodeModules } = require('./official-install');
const { classifyExisting } = require('./adapt');
const { analyzeHooks } = require('./hook-compat');
const { repairProjectInstallState } = require('./install-state-repair');

function runOfficialDoctor(projectRoot, target) {
  const root = eccRoot();
  const doctor = path.join(root, 'scripts', 'doctor.js');
  const nodeModules = resolveNodeModules(root);
  const env = { ...process.env };
  if (nodeModules) {
    env.NODE_PATH = [nodeModules, env.NODE_PATH].filter(Boolean).join(path.delimiter);
  }
  const args = [doctor, '--json'];
  if (target) {
    args.push('--target', target);
  }
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = { raw: result.stdout };
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    report: parsed,
  };
}

function doctorRepo(projectRoot) {
  const resolved = path.resolve(projectRoot);
  const iafStatePath = path.join(resolved, '.iaf-ecc-state.json');
  return {
    inventory: classifyExisting(resolved),
    iafState: fs.existsSync(iafStatePath),
    iafProvenance: fs.existsSync(iafStatePath)
      ? JSON.parse(fs.readFileSync(iafStatePath, 'utf8'))
      : null,
    installState: repairProjectInstallState({ projectRoot: resolved, dryRun: true }),
    hooks: analyzeHooks(resolved),
    officialCursor: runOfficialDoctor(resolved, 'cursor'),
  };
}

module.exports = {
  runOfficialDoctor,
  doctorRepo,
};
