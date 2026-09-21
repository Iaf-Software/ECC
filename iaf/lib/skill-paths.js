'use strict';

const HARNESS_SURFACES = Object.freeze({
  cursor: {
    skills: ['.cursor/skills'],
    agents: ['.cursor/agents'],
    rules: ['.cursor/rules'],
    commands: ['.cursor/commands'],
    hooks: ['.cursor/hooks.json'],
  },
  claude: {
    skills: ['.claude/skills'],
    agents: ['.claude/agents'],
    rules: ['.claude/rules'],
    commands: ['.claude/commands'],
    hooks: ['.claude/settings.json'],
  },
  'claude-project': {
    skills: ['.claude/skills'],
    agents: ['.claude/agents'],
    rules: ['.claude/rules'],
    commands: ['.claude/commands'],
    hooks: ['.claude/settings.json'],
  },
  codex: {
    skills: [],
    agents: [],
    rules: [],
    commands: [],
    hooks: [],
    projectContext: ['AGENTS.md'],
  },
  gemini: {
    skills: ['.gemini'],
    agents: ['.gemini'],
    rules: ['.gemini'],
    commands: ['.gemini'],
    hooks: [],
    projectContext: ['.gemini/GEMINI.md'],
  },
  antigravity: {
    skills: ['.agents/skills'],
    agents: ['.agents/agents'],
    rules: ['.agents/rules'],
    commands: ['.agents/workflows'],
    hooks: [],
  },
});

function surfacesFor(harness) {
  const key = String(harness || '').toLowerCase();
  return HARNESS_SURFACES[key] || null;
}

function orderedDiscoveryPaths(harness) {
  const surfaces = surfacesFor(harness);
  if (!surfaces) {
    return [];
  }
  return [
    ...(surfaces.skills || []),
    ...(surfaces.agents || []),
    ...(surfaces.rules || []),
    ...(surfaces.commands || []),
    ...(surfaces.hooks || []),
    ...(surfaces.projectContext || []),
  ];
}

function isClaudeFirstViolation(requestedPath, harness) {
  const current = String(harness || '').toLowerCase();
  if (current === 'claude' || current === 'claude-project') {
    return false;
  }
  const rel = String(requestedPath || '').replace(/\\/g, '/');
  const startsClaude = rel.startsWith('.claude/') || rel.includes('/.claude/');
  const currentSurfaces = orderedDiscoveryPaths(current);
  const allowed = currentSurfaces.some(prefix => rel === prefix || rel.startsWith(`${prefix}/`) || rel.startsWith(prefix));
  return startsClaude && !allowed;
}

function resolveCapabilityPath(harness, kind, name) {
  const surfaces = surfacesFor(harness);
  if (!surfaces) {
    return null;
  }
  const roots = surfaces[kind];
  if (!Array.isArray(roots) || roots.length === 0) {
    return null;
  }
  const root = roots[0];
  if (!name) {
    return root;
  }
  if (root === name || root.endsWith(`/${name}`)) {
    return root;
  }
  return `${root}/${name}`;
}

module.exports = {
  HARNESS_SURFACES,
  surfacesFor,
  orderedDiscoveryPaths,
  isClaudeFirstViolation,
  resolveCapabilityPath,
};
