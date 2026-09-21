'use strict';

const { loadPolicy } = require('./paths');

function loadRegressionMatrix() {
  return loadPolicy('regression-matrix.json');
}

function classifyIafTouch(input = {}) {
  if (input.disablesCapability && !input.explicitPolicyDisable) {
    return 'CAPABILITY_REMOVAL';
  }
  if (input.explicitPolicyDisable) {
    return 'DEFAULT_POLICY';
  }
  if (input.changesUpstreamSource) {
    return 'UPSTREAM_OVERRIDE';
  }
  if (input.changesGeneratedCopy && input.preservesPreferredMetadata) {
    return 'COMPATIBILITY_FIX';
  }
  if (input.changesGeneratedCopy) {
    return 'COMPATIBILITY_FIX';
  }
  if (input.additiveOnly) {
    return 'ADDITIVE';
  }
  return 'UNTOUCHED';
}

module.exports = {
  loadRegressionMatrix,
  classifyIafTouch,
};
