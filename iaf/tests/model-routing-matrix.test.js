'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyModelFailure,
  resolveModel,
  nextFallbackAfterFailure,
  MODEL_AVAILABILITY_CLASSES,
  transformCursorAgentFrontmatter,
} = require('../lib/model-routing');

describe('model routing failure matrix', () => {
  const specialist = { role: 'architect' };

  for (const failureClass of MODEL_AVAILABILITY_CLASSES) {
    it(`retries bounded fallback for ${failureClass}`, () => {
      const retry = nextFallbackAfterFailure({
        harness: 'cursor',
        specialist,
        preferred: 'sonnet',
        failedModel: 'sonnet',
        error: { code: failureClass, message: failureClass },
        inheritUsable: true,
      });
      assert.equal(retry.failureClass, failureClass);
      assert.equal(retry.retry, true);
      assert.equal(retry.specialistRole, 'architect');
      assert.equal(retry.selected, 'inherit');
      assert.ok(!retry.attempted.includes(retry.selected) || retry.selected !== 'sonnet');
    });
  }

  it('does not fallback for SPECIALIST_FAILED_FOR_NON_MODEL_REASON', () => {
    const retry = nextFallbackAfterFailure({
      harness: 'cursor',
      specialist,
      preferred: 'sonnet',
      failedModel: 'sonnet',
      error: { message: 'syntaxerror in specialist output' },
      inheritUsable: true,
    });
    assert.equal(retry.retry, false);
    assert.equal(retry.failureClass, 'SPECIALIST_FAILED_FOR_NON_MODEL_REASON');
  });

  it('preserves specialist, harness, and attempt bound across fallback', () => {
    let attempted = [];
    let failedModel = 'sonnet';
    let selected = 'sonnet';
    for (let i = 0; i < 5; i += 1) {
      const retry = nextFallbackAfterFailure({
        harness: 'cursor',
        specialist,
        preferred: 'sonnet',
        failedModel,
        attempted,
        error: { message: 'quota exhausted' },
        inheritUsable: true,
        availableModels: ['composer-family'],
        maxAttempts: 3,
      });
      attempted = retry.attempted || attempted;
      failedModel = retry.selected;
      selected = retry.selected;
      if (!retry.retry) {
        break;
      }
    }
    assert.ok(attempted.length <= 3);
    assert.equal(attempted.filter(item => item === 'sonnet').length <= 1, true);
    assert.ok(selected !== 'sonnet' || attempted.length === 0);
  });

  it('repository identity is ignored by the router', () => {
    const a = resolveModel({
      harness: 'cursor',
      specialist,
      preferred: 'sonnet',
      inheritUsable: true,
      availableModels: [],
      repository: 'future-unknown-repo',
    });
    const b = resolveModel({
      harness: 'cursor',
      specialist,
      preferred: 'sonnet',
      inheritUsable: true,
      availableModels: [],
      repository: 'another-disposable-fixture',
    });
    assert.equal(a.selected, b.selected);
    assert.equal(a.preferred, 'sonnet');
  });

  it('records upstream preferred model instead of deleting it', () => {
    const result = transformCursorAgentFrontmatter(`---
name: architect
model: opus
---
body
`);
    assert.match(result.content, /model: inherit/);
    assert.match(result.content, /IAF_UPSTREAM_PREFERRED_MODEL: opus/);
    assert.match(result.content, /IAF_CURSOR_EXECUTION_MODEL_POLICY: inherit/);
    assert.equal(result.preferred, 'opus');
  });

  it('classifies each named failure string', () => {
    assert.equal(classifyModelFailure({ message: 'model not found' }), 'MODEL_NOT_FOUND');
    assert.equal(classifyModelFailure({ message: 'not supported by this harness' }, { harness: 'codex', preferred: 'sonnet', preferredUnsupported: true }), 'MODEL_NOT_SUPPORTED_BY_HARNESS');
    assert.equal(classifyModelFailure({ message: 'provider disabled' }), 'MODEL_PROVIDER_DISABLED');
    assert.equal(classifyModelFailure({ message: 'quota exceeded' }), 'MODEL_QUOTA_EXHAUSTED');
    assert.equal(classifyModelFailure({ message: 'credit limit reached' }), 'MODEL_CREDIT_LIMIT');
    assert.equal(classifyModelFailure({ message: 'spending limit' }), 'MODEL_SPENDING_LIMIT');
    assert.equal(classifyModelFailure({ message: 'auth required' }), 'MODEL_AUTH_REQUIRED');
    assert.equal(classifyModelFailure({ message: 'temporarily unavailable' }), 'MODEL_TEMPORARILY_UNAVAILABLE');
    assert.equal(classifyModelFailure({ message: 'rate limit' }), 'MODEL_RATE_LIMIT');
  });
});
