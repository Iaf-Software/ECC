'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { rewriteCursorHookSource, needsCursorHookRewrite } = require('../lib/hook-compat');
const { applyCursorHookCompat } = require('../lib/overlay');

describe('cursor hook path compatibility', () => {
  it('rewrites repo-root requires to .cursor-relative requires', () => {
    const source = [
      "const { splitShellSegments } = require('../../scripts/lib/shell-split');",
      "function getPluginRoot() { return path.resolve(__dirname, '..', '..'); }",
    ].join('\n');
    const rewritten = rewriteCursorHookSource(source);
    assert.equal(rewritten.changed, true);
    assert.match(rewritten.content, /require\('\.\.\/scripts\/lib\/shell-split'\)/);
    assert.match(rewritten.content, /path\.resolve\(__dirname, '\.\.'\)/);
    assert.doesNotMatch(rewritten.content, /require\('\.\.\/\.\.\/scripts\//);
  });

  it('applies rewrite only to generated copies in a disposable project', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iaf-hook-'));
    const filePath = path.join(root, '.cursor', 'hooks', 'before-shell-execution.js');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "const x = require('../../scripts/lib/shell-split');\n");
    const changed = applyCursorHookCompat(root);
    const next = fs.readFileSync(filePath, 'utf8');
    assert.deepEqual(changed, [path.join('.cursor', 'hooks', 'before-shell-execution.js')]);
    assert.match(next, /require\('\.\.\/scripts\/lib\/shell-split'\)/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('detects the upstream adapter bug pattern', () => {
    const adapter = fs.readFileSync(path.join(__dirname, '..', '..', '.cursor', 'hooks', 'adapter.js'), 'utf8');
    const beforeShell = fs.readFileSync(path.join(__dirname, '..', '..', '.cursor', 'hooks', 'before-shell-execution.js'), 'utf8');
    assert.equal(needsCursorHookRewrite(adapter), true);
    assert.equal(needsCursorHookRewrite(beforeShell), true);
  });
});
