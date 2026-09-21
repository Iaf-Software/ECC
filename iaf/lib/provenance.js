'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { eccRoot, iafVersion, packageVersion } = require('./paths');
const { inspectRepo, githubSlugFromRemote } = require('./identity');

function gitCommit(root) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function readInstallState(projectRoot, targetDir) {
  const filePath = path.join(projectRoot, targetDir, 'ecc-install-state.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildProvenance(options = {}) {
  const projectRoot = options.projectRoot;
  const repo = projectRoot ? inspectRepo(projectRoot) : null;
  const sourceRoot = options.eccRoot || eccRoot();
  const officialState = options.officialState || (projectRoot ? readInstallState(projectRoot, '.cursor') : null);
  const source = officialState && officialState.source ? officialState.source : {};
  return {
    schemaVersion: 1,
    iafExtensionVersion: iafVersion(),
    iafForkCommit: gitCommit(sourceRoot),
    officialEccVersion: source.repoVersion || packageVersion(sourceRoot),
    officialUpstreamCommit: source.repoCommit || gitCommit(sourceRoot),
    installedAt: new Date().toISOString(),
    harnesses: options.harnesses || [],
    profile: options.profile || 'developer',
    hooksEnabled: Boolean(options.hooksEnabled),
    modelRoutingPolicy: 'iaf/policy/model-routing.json',
    fallbackPolicy: 'preferred-if-usable-else-harness-native',
    mcpOptional: 'off',
    project: {
      path: projectRoot || null,
      origin: repo ? repo.origin : null,
      github: repo ? githubSlugFromRemote(repo.origin) : null,
      branch: repo ? repo.branch : null,
      head: repo ? repo.head : null,
    },
    managed: {
      iafOwned: [
        '.iaf-ecc-state.json',
        '.cursor/rules/iaf-autonomous-orchestration.mdc',
        '.cursor/rules/iaf-model-routing.mdc',
        '.cursor/iaf/model-routing.json',
      ],
      upstreamGenerated: ['.cursor/ecc-install-state.json', '.gemini/ecc-install-state.json', '.agents/ecc-install-state.json'],
      projectSpecificPreserved: ['AGENTS.md', 'CLAUDE.md', 'docs/**'],
    },
    ownership: {
      upstreamOwned: 'Everything outside iaf/ in Iaf-Software/ECC, plus official generated adapter files.',
      iafOwned: 'iaf/** and generated IAF overlay files listed above.',
      generated: 'Official ECC install-state and copied adapter files.',
      projectSpecific: 'Repository docs, AGENTS.md facts, unrelated IDE config.',
    },
  };
}

function writeProvenance(projectRoot, provenance) {
  const filePath = path.join(projectRoot, '.iaf-ecc-state.json');
  fs.writeFileSync(filePath, `${JSON.stringify(provenance, null, 2)}\n`);
  return filePath;
}

module.exports = {
  buildProvenance,
  writeProvenance,
  readInstallState,
};
