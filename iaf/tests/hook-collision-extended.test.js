'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { analyzeHooks } = require('../lib/hook-compat');

function writeHooks(root, payload) {
  const filePath = path.join(root, '.cursor', 'hooks.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (typeof payload === 'string') {
    fs.writeFileSync(filePath, payload);
  } else {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  }
  return root;
}

describe('hook collision analysis', () => {
  it('treats missing hooks as no collision', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hooks-none-'));
    const result = analyzeHooks(root);
    assert.equal(result.present, false);
    assert.equal(result.collision, false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports an existing unrelated third-party hook as a collision', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hooks-unrelated-'));
    writeHooks(root, {
      hooks: { beforeShellExecution: [{ command: 'node tools/gateguard.js' }] },
    });
    const result = analyzeHooks(root);
    assert.equal(result.collision, true);
    assert.equal(result.conflicting.length > 0, true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('treats official ECC same-event hooks as compatible', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hooks-compat-'));
    writeHooks(root, {
      hooks: {
        beforeShellExecution: [{ command: 'node .cursor/hooks/before-shell-execution.js' }],
        afterFileEdit: [{ command: 'node .cursor/scripts/hooks/after-file-edit.js' }],
      },
    });
    const result = analyzeHooks(root);
    assert.equal(result.collision, false);
    assert.equal(result.compatible.length >= 1, true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('flags malformed hook configuration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hooks-bad-'));
    writeHooks(root, '{not json');
    const result = analyzeHooks(root);
    assert.equal(result.malformed, true);
    assert.equal(result.collision, true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports missing hook executables', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hooks-miss-'));
    writeHooks(root, {
      hooks: { sessionStart: [{ command: 'node .cursor/hooks/session-start.js' }] },
    });
    const result = analyzeHooks(root);
    assert.equal(result.missingExecutables.length > 0, true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports unsafe hook paths', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hooks-unsafe-'));
    writeHooks(root, {
      hooks: { beforeReadFile: [{ command: 'node /etc/passwd' }] },
    });
    const result = analyzeHooks(root);
    assert.equal(result.unsafePaths.length > 0, true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
