'use strict';

const fs = require('fs');
const path = require('path');
const { rewriteCursorHookSource } = require('../hook-compat');
const { transformCursorAgentFrontmatter } = require('../model-routing');

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

function applyHookCompat(projectRoot) {
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

function applyAgentModelTransform(projectRoot, context = {}) {
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
  id: 'cursor',
  applyHookCompat,
  applyAgentModelTransform,
  detectHookCollision,
  walkFiles,
};
