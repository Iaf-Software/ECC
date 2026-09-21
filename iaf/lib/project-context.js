'use strict';

const fs = require('fs');
const path = require('path');

const GENERIC_DOC_CANDIDATES = Object.freeze([
  'AGENTS.md',
  'CLAUDE.md',
  'docs/PROJECT_SPEC.md',
  'docs/ENVIRONMENT.md',
  'docs/DEPLOYMENT.md',
  'docs/PRODUCTION_SAFETY.md',
  'docs/BACKUP_RESTORE.md',
  'docs/SECURITY.md',
  'docs/GIT_WORKFLOW.md',
  'docs/architecture',
  'docs/adr',
  'docs/memory',
]);

function pathExists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function listMarkdown(dirPath, limit = 40) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }
  const found = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (found.length >= limit) {
      break;
    }
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      found.push(...listMarkdown(full, limit - found.length).map(child => path.join(entry.name, child)));
    } else if (/\.(md|mdc)$/i.test(entry.name)) {
      found.push(entry.name);
    }
  }
  return found;
}

function discoverProjectContext(projectRoot) {
  const root = path.resolve(projectRoot);
  const present = [];
  for (const candidate of GENERIC_DOC_CANDIDATES) {
    if (pathExists(root, candidate)) {
      present.push(candidate);
    }
  }
  const architectureFiles = listMarkdown(path.join(root, 'docs', 'architecture'));
  return {
    projectRoot: root,
    present,
    architectureFiles: architectureFiles.map(file => path.join('docs/architecture', file)),
    note: 'Discovered from the repository tree. Do not treat missing files as license to invent facts.',
  };
}

module.exports = {
  GENERIC_DOC_CANDIDATES,
  discoverProjectContext,
};
