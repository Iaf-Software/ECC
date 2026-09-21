'use strict';

const FORBIDDEN_GIT_PATTERNS = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-fdx?\b/,
  /\bgit\s+push\b[^\n]*--force\b/,
  /\bgit\s+push\b[^\n]*-f\b/,
  /\bgit\s+filter-branch\b/,
  /\bgit\s+rebase\s+-i\b/,
  /\bgit\s+add\s+\.(?:\s|$)/,
  /\bgit\s+add\s+-A\b/,
  /\bgit\s+add\s+--all\b/,
];

const FORBIDDEN_DB_PATTERNS = [
  /\bmigrate:fresh\b/i,
  /\bmigrate:reset\b/i,
  /\bdb:wipe\b/i,
  /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,
  /\bTRUNCATE\b/i,
];

function isForbiddenCommand(command) {
  const text = String(command || '');
  return FORBIDDEN_GIT_PATTERNS.some(rx => rx.test(text))
    || FORBIDDEN_DB_PATTERNS.some(rx => rx.test(text));
}

function assertSafeGitArgs(args) {
  const joined = ['git', ...(args || [])].join(' ');
  if (isForbiddenCommand(joined)) {
    const error = new Error(`Refusing forbidden git/data command: ${joined}`);
    error.code = 'IAF_FORBIDDEN_COMMAND';
    throw error;
  }
}

function classifyDirtyPath(relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  if (rel.startsWith('.cursor/') || rel.startsWith('.claude/') || rel.startsWith('.gemini/') || rel.startsWith('.agents/') || rel === 'AGENTS.md' || rel === 'CLAUDE.md') {
    if (rel.includes('iaf-') || rel.includes('.iaf-ecc')) {
      return 'IAF_ECC_MANAGED';
    }
    return 'ECC_MANAGED';
  }
  if (rel === '.iaf-ecc-state.json' || rel.startsWith('.iaf/')) {
    return 'IAF_ECC_MANAGED';
  }
  if (/(^|\/)(node_modules|vendor|storage\/|.pid|.lock)(\/|$)/.test(rel) || rel.endsWith('.pid') || rel.endsWith('.lock')) {
    return 'RUNTIME';
  }
  if (rel.startsWith('artifacts/') || rel.startsWith('storage/')) {
    return 'GENERATED';
  }
  if (rel.startsWith('docs/') || rel.startsWith('.cursor/rules/') && !rel.includes('ecc-')) {
    return 'PROJECT_SPECIFIC_CONFIG';
  }
  return 'UNKNOWN';
}

module.exports = {
  FORBIDDEN_GIT_PATTERNS,
  isForbiddenCommand,
  assertSafeGitArgs,
  classifyDirtyPath,
};
