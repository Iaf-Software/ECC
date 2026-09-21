'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { classifyIafPath, forbidsConsumerReferences } = require('../lib/ownership');

const FORBIDDEN = [
  /omnipos/i,
  /iaf-omnipos/i,
  /temasuite/i,
  /optibuild/i,
  /remaoptibuild/i,
  /mielepi[uù]/i,
  /bekeen/i,
  /anccsrl/i,
  /kekkoiaf/i,
  /rive04/i,
  /demoinnovedge/i,
  /\/home\/innovedge\//i,
  /\/Users\/kekkoiaf\//i,
  /Iaf-Software\/wip/i,
  /Iaf-Software\/ancc/i,
];

const CORE_ROOTS = ['lib', 'bin', 'templates', 'policy'];

function walk(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) {
    return files;
  }
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

describe('consumer reference audit', () => {
  it('forbids consumer identities in generic core and harness adapters', () => {
    const iafRoot = path.join(__dirname, '..');
    const eccRoot = path.join(iafRoot, '..');
    const hits = [];
    for (const root of CORE_ROOTS) {
      for (const file of walk(path.join(iafRoot, root))) {
        const rel = path.relative(eccRoot, file).replace(/\\/g, '/');
        const classification = classifyIafPath(rel);
        if (!forbidsConsumerReferences(classification)) {
          continue;
        }
        const text = fs.readFileSync(file, 'utf8');
        for (const pattern of FORBIDDEN) {
          if (pattern.test(text)) {
            hits.push({ file: rel, pattern: String(pattern), classification });
          }
        }
      }
    }
    assert.deepEqual(hits, []);
  });

  it('classifies operator inventory as fleet data, not core', () => {
    assert.equal(classifyIafPath('iaf/operator/fleet.inventory.json'), 'IAF_FLEET_DATA');
    assert.equal(classifyIafPath('iaf/lib/model-routing.js'), 'IAF_GENERIC_CORE');
    assert.equal(classifyIafPath('iaf/lib/harnesses/cursor.js'), 'IAF_HARNESS_ADAPTER');
    assert.equal(classifyIafPath('iaf/docs/reference/OMNIPOS_RECONCILIATION.md'), 'REPORT/DOCUMENTATION');
    assert.equal(forbidsConsumerReferences('IAF_FLEET_DATA'), false);
    assert.equal(forbidsConsumerReferences('IAF_GENERIC_CORE'), true);
  });
});
