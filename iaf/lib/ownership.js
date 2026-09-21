'use strict';

const path = require('path');
const { iafRoot } = require('./paths');

const CLASSIFICATIONS = Object.freeze({
  UPSTREAM_ECC: 'UPSTREAM_ECC',
  IAF_GENERIC_CORE: 'IAF_GENERIC_CORE',
  IAF_HARNESS_ADAPTER: 'IAF_HARNESS_ADAPTER',
  IAF_FLEET_DATA: 'IAF_FLEET_DATA',
  GENERATED_PROJECT_CONFIG: 'GENERATED_PROJECT_CONFIG',
  PROJECT_SPECIFIC: 'PROJECT_SPECIFIC',
  TEST_FIXTURE: 'TEST_FIXTURE',
  REPORT_DOCUMENTATION: 'REPORT/DOCUMENTATION',
});

const CORE_ZERO_CONSUMER = Object.freeze([
  'iaf/lib',
  'iaf/bin',
  'iaf/templates',
  'iaf/policy',
]);

function classifyIafPath(relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  if (rel.startsWith('iaf/operator/')) {
    return CLASSIFICATIONS.IAF_FLEET_DATA;
  }
  if (rel.startsWith('iaf/docs/reference/') || rel === 'iaf/docs/MANUAL_ACTIONS_REQUIRED.md') {
    return CLASSIFICATIONS.REPORT_DOCUMENTATION;
  }
  if (rel.startsWith('iaf/docs/')) {
    return CLASSIFICATIONS.REPORT_DOCUMENTATION;
  }
  if (rel.startsWith('iaf/tests/')) {
    return CLASSIFICATIONS.TEST_FIXTURE;
  }
  if (rel.startsWith('iaf/lib/harnesses/')) {
    return CLASSIFICATIONS.IAF_HARNESS_ADAPTER;
  }
  if (rel.startsWith('iaf/templates/')) {
    return CLASSIFICATIONS.IAF_HARNESS_ADAPTER;
  }
  if (rel.startsWith('iaf/lib/') || rel.startsWith('iaf/bin/') || rel.startsWith('iaf/policy/')) {
    return CLASSIFICATIONS.IAF_GENERIC_CORE;
  }
  if (rel.startsWith('iaf/')) {
    return CLASSIFICATIONS.IAF_GENERIC_CORE;
  }
  return CLASSIFICATIONS.UPSTREAM_ECC;
}

function forbidsConsumerReferences(classification) {
  return classification === CLASSIFICATIONS.IAF_GENERIC_CORE
    || classification === CLASSIFICATIONS.IAF_HARNESS_ADAPTER;
}

function coreRoot() {
  return iafRoot();
}

function relativeFromEcc(filePath, eccRoot) {
  return path.relative(eccRoot, filePath).replace(/\\/g, '/');
}

module.exports = {
  CLASSIFICATIONS,
  CORE_ZERO_CONSUMER,
  classifyIafPath,
  forbidsConsumerReferences,
  coreRoot,
  relativeFromEcc,
};
