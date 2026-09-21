'use strict';

const fs = require('fs');
const path = require('path');
const { rewriteCursorHookSource } = require('./hook-compat');
const { transformCursorAgentFrontmatter } = require('./model-routing');
const { iafRoot } = require('./paths');

function walkFiles(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) {
    return files;
  }
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function applyCursorHookCompat(projectRoot) {
  const hooksDir = path.join(projectRoot, '.cursor', 'hooks');
  const changed = [];
  for (const filePath of walkFiles(hooksDir)) {
    if (!filePath.endsWith('.js')) {
      continue;
    }
    const original = fs.readFileSync(filePath, 'utf8');
    const rewritten = rewriteCursorHookSource(original);
    if (rewritten.changed) {
      fs.writeFileSync(filePath, rewritten.content);
      changed.push(path.relative(projectRoot, filePath));
    }
  }
  return changed;
}

function applyCursorAgentModelTransform(projectRoot, context = {}) {
  const agentsDir = path.join(projectRoot, '.cursor', 'agents');
  const changed = [];
  const sidecar = {};
  for (const filePath of walkFiles(agentsDir)) {
    if (!filePath.endsWith('.md')) {
      continue;
    }
    const original = fs.readFileSync(filePath, 'utf8');
    const result = transformCursorAgentFrontmatter(original, context);
    if (result.changed) {
      fs.writeFileSync(filePath, result.content);
      changed.push(path.relative(projectRoot, filePath));
    }
    if (result.preferred) {
      sidecar[path.basename(filePath)] = {
        preferred: result.preferred,
        actual: result.actual || result.preferred,
      };
    }
  }
  const sidecarDir = path.join(projectRoot, '.cursor', 'iaf');
  fs.mkdirSync(sidecarDir, { recursive: true });
  fs.writeFileSync(
    path.join(sidecarDir, 'model-routing.json'),
    `${JSON.stringify({ version: 1, harness: 'cursor', specialists: sidecar }, null, 2)}\n`
  );
  return changed;
}

function installPolicyTemplates(projectRoot, harnesses) {
  const installed = [];
  const templatesRoot = path.join(iafRoot(), 'templates');
  const mapping = {
    cursor: [
      ['cursor/rules/iaf-autonomous-orchestration.mdc', '.cursor/rules/iaf-autonomous-orchestration.mdc'],
      ['cursor/rules/iaf-model-routing.mdc', '.cursor/rules/iaf-model-routing.mdc'],
    ],
    gemini: [
      ['gemini/iaf-orchestration.md', '.gemini/iaf-orchestration.md'],
    ],
    antigravity: [
      ['antigravity/iaf-orchestration.md', '.agents/iaf-orchestration.md'],
    ],
    claude: [
      ['claude/iaf-orchestration.md', '.claude/iaf-orchestration.md'],
    ],
    'claude-project': [
      ['claude/iaf-orchestration.md', '.claude/iaf-orchestration.md'],
    ],
    codex: [
      ['codex/iaf-orchestration.md', '.iaf/codex-iaf-orchestration.md'],
    ],
  };

  for (const harness of harnesses) {
    for (const [fromRel, toRel] of mapping[harness] || []) {
      const src = path.join(templatesRoot, fromRel);
      const dest = path.join(projectRoot, toRel);
      if (!fs.existsSync(src)) {
        continue;
      }
      copyFile(src, dest);
      installed.push(toRel);
    }
  }
  return installed;
}

function detectHookCollision(projectRoot) {
  const hooksJson = path.join(projectRoot, '.cursor', 'hooks.json');
  if (!fs.existsSync(hooksJson)) {
    return { collision: false, existing: [] };
  }
  const parsed = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
  const existing = [];
  const events = parsed.hooks || parsed;
  if (events && typeof events === 'object') {
    for (const [eventName, entries] of Object.entries(events)) {
      if (!Array.isArray(entries)) {
        continue;
      }
      for (const entry of entries) {
        const command = String(entry.command || '');
        if (command && !command.includes('.cursor/hooks/') && !command.includes('.cursor/scripts/hooks/')) {
          existing.push({ event: eventName, command });
        }
      }
    }
  }
  return { collision: existing.length > 0, existing };
}

module.exports = {
  applyCursorHookCompat,
  applyCursorAgentModelTransform,
  installPolicyTemplates,
  detectHookCollision,
  walkFiles,
};
