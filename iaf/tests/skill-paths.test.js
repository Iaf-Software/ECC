'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  orderedDiscoveryPaths,
  isClaudeFirstViolation,
  resolveCapabilityPath,
} = require('../lib/skill-paths');

describe('harness-aware skill paths', () => {
  it('Cursor discovery starts at .cursor, not .claude', () => {
    const paths = orderedDiscoveryPaths('cursor');
    assert.equal(paths[0].startsWith('.cursor'), true);
    assert.equal(paths.some(item => item.startsWith('.claude')), false);
  });

  it('flags Claude-first resolution on Cursor', () => {
    assert.equal(isClaudeFirstViolation('.claude/skills/security-review/SKILL.md', 'cursor'), true);
    assert.equal(isClaudeFirstViolation('.cursor/skills/security-review/SKILL.md', 'cursor'), false);
    assert.equal(isClaudeFirstViolation('.claude/skills/security-review/SKILL.md', 'claude'), false);
  });

  it('resolves specialist files on the current harness', () => {
    assert.equal(resolveCapabilityPath('cursor', 'agents', 'ecc-architect.md'), '.cursor/agents/ecc-architect.md');
    assert.equal(resolveCapabilityPath('gemini', 'projectContext', 'GEMINI.md'), '.gemini/GEMINI.md');
    assert.equal(resolveCapabilityPath('antigravity', 'skills', 'security-review/SKILL.md'), '.agents/skills/security-review/SKILL.md');
  });
});
