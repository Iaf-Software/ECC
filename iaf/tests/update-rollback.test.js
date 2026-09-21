'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectIafOverlap, classifyChangedFiles } = require('../lib/upstream-sync');

describe('upstream update overlap and rollback signals', () => {
  it('refuses silent overwrite when upstream would touch iaf/', () => {
    const overlap = classifyChangedFiles([
      'scripts/doctor.js',
      'iaf/lib/model-routing.js',
    ]);
    assert.equal(overlap.safe, false);
    assert.deepEqual(overlap.upstreamTouchedIafTree, ['iaf/lib/model-routing.js']);
  });

  it('allows official-only upstream files', () => {
    const overlap = classifyChangedFiles([
      'scripts/lib/platform-launch.js',
      'tests/lib/platform-launch.test.js',
    ]);
    assert.equal(overlap.safe, true);
  });

  it('preview overlap helper still uses git range for HEAD..HEAD', () => {
    const overlap = detectIafOverlap('HEAD', 'HEAD');
    assert.equal(overlap.safe, true);
  });
});
