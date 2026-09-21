'use strict';

const fs = require('fs');
const path = require('path');
const { iafRoot } = require('./paths');
const cursor = require('./harnesses/cursor');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
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

module.exports = {
  applyCursorHookCompat: cursor.applyHookCompat,
  applyCursorAgentModelTransform: cursor.applyAgentModelTransform,
  detectHookCollision: cursor.detectHookCollision,
  walkFiles: cursor.walkFiles,
  installPolicyTemplates,
};
