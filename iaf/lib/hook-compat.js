'use strict';

function rewriteCursorHookSource(source) {
  const original = String(source || '');
  const rewritten = original
    .replace(/require\((['"])\.\.\/\.\.\/scripts\//g, 'require($1../scripts/')
    .replace(/path\.resolve\(__dirname,\s*['"]\.\.['"],\s*['"]\.\.['"]\)/g, "path.resolve(__dirname, '..')");
  return {
    content: rewritten,
    changed: rewritten !== original,
  };
}

function needsCursorHookRewrite(source) {
  const text = String(source || '');
  return /require\((['"])\.\.\/\.\.\/scripts\//.test(text)
    || /path\.resolve\(__dirname,\s*['"]\.\.['"],\s*['"]\.\.['"]\)/.test(text);
}

function isOfficialHookCommand(command) {
  const text = String(command || '');
  return text.includes('.cursor/hooks/') || text.includes('.cursor/scripts/hooks/');
}

function extractCommandPath(command) {
  const text = String(command || '').trim();
  const match = text.match(/(?:node|python3?|bash|sh)\s+("[^"]+"|'[^']+'|[^\s]+)/i);
  if (!match) {
    return null;
  }
  return match[1].replace(/^['"]|['"]$/g, '');
}

function analyzeHooks(projectRoot) {
  const fs = require('fs');
  const path = require('path');
  const hooksJson = path.join(projectRoot, '.cursor', 'hooks.json');
  if (!fs.existsSync(hooksJson)) {
    return {
      present: false,
      collision: false,
      malformed: false,
      existing: [],
      compatible: [],
      conflicting: [],
      missingExecutables: [],
      unsafePaths: [],
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
  } catch {
    return {
      present: true,
      collision: true,
      malformed: true,
      existing: [],
      compatible: [],
      conflicting: [{ event: '*', command: '(malformed hooks.json)' }],
      missingExecutables: [],
      unsafePaths: [],
    };
  }
  const existing = [];
  const compatible = [];
  const conflicting = [];
  const missingExecutables = [];
  const unsafePaths = [];
  const events = parsed.hooks || parsed;
  if (events && typeof events === 'object') {
    for (const [eventName, entries] of Object.entries(events)) {
      if (!Array.isArray(entries)) {
        continue;
      }
      for (const entry of entries) {
        const command = String(entry.command || '');
        if (!command) {
          continue;
        }
        const record = { event: eventName, command };
        existing.push(record);
        if (isOfficialHookCommand(command)) {
          compatible.push(record);
        } else {
          conflicting.push(record);
        }
        const commandPath = extractCommandPath(command);
        if (commandPath) {
          const resolved = path.isAbsolute(commandPath)
            ? commandPath
            : path.resolve(projectRoot, commandPath);
          const underProject = resolved === projectRoot || resolved.startsWith(`${projectRoot}${path.sep}`);
          if (!underProject || resolved.includes(`${path.sep}etc${path.sep}`) || resolved === '/etc/passwd') {
            unsafePaths.push(record);
          }
          if (underProject && !fs.existsSync(resolved)) {
            missingExecutables.push(record);
          }
        }
      }
    }
  }
  return {
    present: true,
    collision: conflicting.length > 0 || unsafePaths.length > 0,
    malformed: false,
    existing,
    compatible,
    conflicting,
    missingExecutables,
    unsafePaths,
  };
}

module.exports = {
  rewriteCursorHookSource,
  needsCursorHookRewrite,
  analyzeHooks,
  isOfficialHookCommand,
};
