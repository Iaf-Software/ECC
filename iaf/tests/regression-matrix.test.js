'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadRegressionMatrix, classifyIafTouch } = require('../lib/regression-matrix');

describe('official ECC non-regression matrix', () => {
  it('documents every IAF-touched official capability without silent removal', () => {
    const matrix = loadRegressionMatrix();
    assert.ok(Array.isArray(matrix.capabilities));
    assert.ok(matrix.capabilities.length >= 8);
    for (const row of matrix.capabilities) {
      assert.ok(row.officialCapability);
      assert.ok(row.upstreamSource);
      assert.equal(typeof row.iafTouchesIt, 'boolean');
      assert.ok(['ADDITIVE', 'COMPATIBILITY_FIX', 'DEFAULT_POLICY', 'UPSTREAM_OVERRIDE', 'CAPABILITY_REMOVAL', 'UNTOUCHED'].includes(row.classification));
      assert.equal(typeof row.preserved, 'boolean');
      assert.equal(typeof row.disabled, 'boolean');
      if (row.classification === 'CAPABILITY_REMOVAL') {
        assert.ok(row.why && row.why.length > 10);
      }
      assert.equal(row.disabled && row.classification !== 'DEFAULT_POLICY', false);
    }
  });

  it('does not rewrite upstream agent sources', () => {
    const architect = fs.readFileSync(path.join(__dirname, '..', '..', 'agents', 'architect.md'), 'utf8');
    assert.match(architect, /^model: (sonnet|opus|haiku)$/m);
    assert.doesNotMatch(architect, /model: inherit/);
  });

  it('classifies inherit transform as compatibility, not capability removal', () => {
    assert.equal(
      classifyIafTouch({
        changesGeneratedCopy: true,
        changesUpstreamSource: false,
        preservesPreferredMetadata: true,
        disablesCapability: false,
      }),
      'COMPATIBILITY_FIX'
    );
  });
});
