'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function runGit(repoPath, args) {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const error = new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
    error.code = 'IAF_GIT_FAILED';
    error.status = result.status;
    throw error;
  }
  return (result.stdout || '').trim();
}

function assertGitRepo(repoPath) {
  const resolved = path.resolve(repoPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    const error = new Error(`Repository path does not exist: ${resolved}`);
    error.code = 'IAF_IDENTITY_AMBIGUOUS';
    throw error;
  }
  try {
    const inside = runGit(resolved, ['rev-parse', '--is-inside-work-tree']);
    if (inside !== 'true') {
      throw new Error('not a work tree');
    }
  } catch (error) {
    error.code = 'IAF_IDENTITY_AMBIGUOUS';
    throw error;
  }
  return resolved;
}

function inspectRepo(repoPath) {
  const resolved = assertGitRepo(repoPath);
  const head = runGit(resolved, ['rev-parse', 'HEAD']);
  const branch = runGit(resolved, ['rev-parse', '--abbrev-ref', 'HEAD']);
  let origin = null;
  try {
    origin = runGit(resolved, ['remote', 'get-url', 'origin']);
  } catch {
    origin = null;
  }
  const porcelain = runGit(resolved, ['status', '--porcelain']);
  return {
    path: resolved,
    head,
    branch,
    origin,
    dirty: porcelain.length > 0,
    porcelain,
  };
}

function assertExpectedRemote(repoPath, expectedGithub) {
  const info = inspectRepo(repoPath);
  if (!expectedGithub) {
    return info;
  }
  const origin = String(info.origin || '');
  const ok = origin.includes(`${expectedGithub}.git`) || origin.endsWith(expectedGithub) || origin.includes(`/${expectedGithub}`);
  if (!ok) {
    const error = new Error(`Remote does not match expected project ${expectedGithub}: ${origin || '(none)'}`);
    error.code = 'IAF_REMOTE_MISMATCH';
    throw error;
  }
  return info;
}

function githubSlugFromRemote(origin) {
  if (!origin) {
    return null;
  }
  const match = String(origin).match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/i);
  return match ? match[1] : null;
}

module.exports = {
  runGit,
  assertGitRepo,
  inspectRepo,
  assertExpectedRemote,
  githubSlugFromRemote,
};
