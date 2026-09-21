'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifySecretHit, shouldAllowlist } = require('../lib/secret-scanner-compat');

describe('secret scanner non-weakening', () => {
  it('allows ECC detector regex fixtures without treating them as live secrets', () => {
    const result = shouldAllowlist(
      '.cursor/hooks/before-submit-prompt.js',
      '      /sk-[a-zA-Z0-9]{20,}/,       // OpenAI API keys'
    );
    assert.equal(result.class, 'SECURITY_DETECTION_REGEX');
    assert.equal(result.allow, true);
  });

  it('still detects a fake live secret in an ECC-managed-like path', () => {
    const result = shouldAllowlist(
      '.cursor/rules/ecc-core.mdc',
      "API_KEY = 'sk-live-not-a-regex-secret-value'"
    );
    assert.equal(result.allow, false);
    assert.equal(result.class, 'REAL_SECRET');
  });

  it('still detects a fake live secret in .cursor/', () => {
    const result = shouldAllowlist(
      '.cursor/mcp.json',
      'OPENAI_API_KEY=sk-live-abcdefghijklmnopqrstuvwxyz'
    );
    assert.equal(result.allow, false);
    assert.equal(result.class, 'REAL_SECRET');
  });

  it('still detects a fake live secret in an IAF overlay path', () => {
    const result = shouldAllowlist(
      '.cursor/rules/iaf-model-routing.mdc',
      'token = "ghp_liveExampleTokenValue1234"'
    );
    assert.equal(result.allow, false);
    assert.equal(result.class, 'REAL_SECRET');
  });

  it('does not fail normal ECC rules merely because they mention detector patterns', () => {
    const result = shouldAllowlist(
      '.cursor/rules/java-security.mdc',
      'API_KEY = "sk-abc123..."'
    );
    assert.equal(result.class, 'GENERATED_ECC_SECURITY_RULE');
    assert.equal(result.allow, true);
  });

  it('does not globally ignore .cursor', () => {
    assert.equal(classifySecretHit('.cursor/secret.env', 'PASSWORD=supersecretvalue'), 'REAL_SECRET');
  });
});
