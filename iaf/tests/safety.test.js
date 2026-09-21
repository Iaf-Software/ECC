'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifySecretHit, shouldAllowlist } = require('../lib/secret-scanner-compat');
const { isForbiddenCommand, classifyDirtyPath } = require('../lib/git-safety');
const { detectHookCollision } = require('../lib/overlay');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('secret scanner compatibility', () => {
  it('classifies ECC detector regex as SECURITY_DETECTION_REGEX not a live secret', () => {
    const result = shouldAllowlist(
      '.cursor/hooks/before-submit-prompt.js',
      "      /sk-[a-zA-Z0-9]{20,}/,       // OpenAI API keys"
    );
    assert.equal(result.class, 'SECURITY_DETECTION_REGEX');
    assert.equal(result.allow, true);
  });

  it('does not allowlist a real assignment in an unrelated file', () => {
    const result = shouldAllowlist('app/config.js', "const secret = process.env.API_KEY");
    assert.equal(result.allow, false);
  });

  it('treats .env assignments as real secrets', () => {
    assert.equal(classifySecretHit('.env', 'API_KEY=abcd12345678'), 'REAL_SECRET');
  });
});

describe('git safety', () => {
  it('forbids destructive git and db commands', () => {
    assert.equal(isForbiddenCommand('git reset --hard'), true);
    assert.equal(isForbiddenCommand('git clean -fd'), true);
    assert.equal(isForbiddenCommand('git push --force'), true);
    assert.equal(isForbiddenCommand('git add .'), true);
    assert.equal(isForbiddenCommand('php artisan migrate:fresh'), true);
    assert.equal(isForbiddenCommand('git add iaf/lib/cli.js'), false);
  });

  it('classifies dirty paths', () => {
    assert.equal(classifyDirtyPath('.cursor/rules/iaf-model-routing.mdc'), 'IAF_ECC_MANAGED');
    assert.equal(classifyDirtyPath('storage/queue-worker.pid'), 'RUNTIME');
    assert.equal(classifyDirtyPath('src/unknown.js'), 'UNKNOWN');
  });
});

describe('hook collision', () => {
  it('does not treat official ECC cursor hook commands as collisions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hook-col-'));
    const hooksJson = path.join(root, '.cursor', 'hooks.json');
    fs.mkdirSync(path.dirname(hooksJson), { recursive: true });
    fs.writeFileSync(hooksJson, JSON.stringify({
      version: 1,
      hooks: {
        beforeShellExecution: [{ command: 'node .cursor/hooks/before-shell-execution.js' }],
      },
    }));
    const result = detectHookCollision(root);
    assert.equal(result.collision, false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('stops hook activation when a third-party hook command is present', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hook-col2-'));
    const hooksJson = path.join(root, '.cursor', 'hooks.json');
    fs.mkdirSync(path.dirname(hooksJson), { recursive: true });
    fs.writeFileSync(hooksJson, JSON.stringify({
      hooks: {
        beforeShellExecution: [{ command: 'node tools/gateguard.js' }],
      },
    }));
    const result = detectHookCollision(root);
    assert.equal(result.collision, true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
