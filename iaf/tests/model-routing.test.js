'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyModelFailure,
  resolveModel,
  nextFallbackAfterFailure,
  transformCursorAgentFrontmatter,
  isModelAvailabilityFailure,
  buildTelemetry,
} = require('../lib/model-routing');

describe('model routing', () => {
  it('Cursor preferred available uses preferred', () => {
    const result = resolveModel({
      harness: 'cursor',
      specialist: { role: 'architect' },
      preferred: 'sonnet',
      availableModels: ['sonnet'],
    });
    assert.equal(result.selected, 'sonnet');
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.specialistRole, 'architect');
    assert.equal(result.ok, true);
  });

  it('Cursor preferred unavailable falls back to inherit', () => {
    const result = resolveModel({
      harness: 'cursor',
      specialist: { role: 'architect' },
      preferred: 'sonnet',
      availableModels: ['grok'],
      inheritUsable: true,
    });
    assert.equal(result.selected, 'inherit');
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.specialistRole, 'architect');
  });

  it('Cursor spending-limit failure retries same specialist with inherit', () => {
    const retry = nextFallbackAfterFailure({
      harness: 'cursor',
      specialist: { role: 'security-reviewer' },
      preferred: 'sonnet',
      failedModel: 'sonnet',
      error: { message: 'You have hit your spending limit for Other Models' },
      inheritUsable: true,
    });
    assert.equal(retry.failureClass, 'MODEL_SPENDING_LIMIT');
    assert.equal(retry.retry, true);
    assert.equal(retry.selected, 'inherit');
    assert.equal(retry.specialistRole, 'security-reviewer');
    assert.ok(!retry.attempted.includes('sonnet') || retry.selected !== 'sonnet');
    assert.ok(!retry.attempted.filter(item => item === 'sonnet').length || retry.selected !== 'sonnet');
  });

  it('does not retry the same failed model', () => {
    const retry = nextFallbackAfterFailure({
      harness: 'cursor',
      specialist: { role: 'architect' },
      preferred: 'sonnet',
      failedModel: 'inherit',
      attempted: ['sonnet', 'inherit'],
      error: { message: 'quota exhausted' },
      inheritUsable: true,
      availableModels: ['grok'],
    });
    assert.equal(retry.selected, 'cursor-native');
    assert.equal(retry.specialistRole, 'architect');
    assert.ok(!retry.attempted.slice(0, -1).includes(retry.selected) || retry.selected === 'cursor-native');
  });

  it('Cursor all models unavailable degrades without looping', () => {
    const result = resolveModel({
      harness: 'cursor',
      specialist: { role: 'architect' },
      preferred: 'sonnet',
      inheritUsable: false,
      availableModels: [],
      attempted: ['sonnet', 'inherit', 'cursor-native'],
      maxAttempts: 3,
    });
    assert.equal(result.ok, false);
    assert.equal(result.degraded, true);
    assert.ok(result.attempts <= 3);
  });

  it('Codex rejects Claude aliases and uses harness default', () => {
    const result = resolveModel({
      harness: 'codex',
      specialist: { role: 'database-reviewer' },
      preferred: 'sonnet',
    });
    assert.equal(result.selected, 'harness-default');
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.reason, 'MODEL_NOT_SUPPORTED_BY_HARNESS');
    assert.equal(result.specialistRole, 'database-reviewer');
  });

  it('Gemini rejects Claude aliases', () => {
    const result = resolveModel({
      harness: 'gemini',
      specialist: { role: 'planner' },
      preferred: 'opus',
    });
    assert.equal(result.selected, 'harness-default');
    assert.equal(result.specialistRole, 'planner');
  });

  it('Antigravity keeps backend default and does not inject foreign IDs', () => {
    const result = resolveModel({
      harness: 'antigravity',
      specialist: { role: 'code-explorer' },
      preferred: 'sonnet',
    });
    assert.equal(result.selected, 'harness-default');
    assert.equal(result.specialistRole, 'code-explorer');
  });

  it('Claude preserves upstream preferred model', () => {
    const result = resolveModel({
      harness: 'claude',
      specialist: { role: 'planner' },
      preferred: 'opus',
    });
    assert.equal(result.selected, 'opus');
    assert.equal(result.fallbackUsed, false);
  });

  it('does not hide non-model failures by switching models', () => {
    const retry = nextFallbackAfterFailure({
      harness: 'cursor',
      specialist: { role: 'security-reviewer' },
      preferred: 'sonnet',
      failedModel: 'sonnet',
      error: { message: 'Permission denied writing protected file' },
      inheritUsable: true,
    });
    assert.equal(retry.retry, false);
    assert.equal(retry.failureClass, 'SPECIALIST_FAILED_FOR_NON_MODEL_REASON');
  });

  it('classifies quota and auth failures', () => {
    assert.equal(classifyModelFailure({ message: 'quota exceeded' }), 'MODEL_QUOTA_EXHAUSTED');
    assert.equal(classifyModelFailure({ message: 'not authenticated' }), 'MODEL_AUTH_REQUIRED');
    assert.ok(isModelAvailabilityFailure('MODEL_CREDIT_LIMIT'));
  });

  it('transforms generated Cursor agents to inherit while recording preferred', () => {
    const source = `---
name: architect
model: sonnet
---
You are the architect.
`;
    const result = transformCursorAgentFrontmatter(source);
    assert.equal(result.changed, true);
    assert.equal(result.preferred, 'sonnet');
    assert.match(result.content, /model: inherit/);
    assert.match(result.content, /IAF_PREFERRED_MODEL: sonnet/);
    assert.match(result.content, /You are the architect/);
  });

  it('does not rewrite Cursor agents when preferred is explicitly usable', () => {
    const source = `---
name: architect
model: sonnet
---
prompt
`;
    const result = transformCursorAgentFrontmatter(source, { cursorUsePreferredModels: true, availableModels: ['sonnet'] });
    assert.equal(result.changed, false);
  });

  it('telemetry records preferred vs actual without secrets', () => {
    const result = resolveModel({
      harness: 'cursor',
      specialist: { role: 'architect' },
      preferred: 'sonnet',
      inheritUsable: true,
      availableModels: [],
    });
    const telemetry = buildTelemetry(result, { harness: 'cursor' });
    assert.equal(telemetry.specialist, 'architect');
    assert.equal(telemetry.preferred, 'sonnet');
    assert.equal(telemetry.actual, 'inherit');
    assert.equal(telemetry.fallback, 'YES');
    assert.equal(telemetry.harness, 'cursor');
    const blob = JSON.stringify(telemetry);
    assert.equal(/sk-|ghp_|account|billing/i.test(blob), false);
  });
});
