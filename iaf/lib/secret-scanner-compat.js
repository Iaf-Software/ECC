'use strict';

const path = require('path');
const { loadPolicy } = require('./paths');

function classifySecretHit(filePath, line, policy = loadPolicy('secret-scanner-compat.json')) {
  const rel = String(filePath || '').replace(/\\/g, '/');
  const text = String(line || '');
  for (const fingerprint of policy.detectorFingerprints || []) {
    if (!rel.endsWith(fingerprint.pathSuffix) && !rel.includes(`/${fingerprint.pathSuffix}`)) {
      continue;
    }
    if (text.includes(fingerprint.mustContain) || rel.endsWith(path.basename(fingerprint.pathSuffix))) {
      return fingerprint.class;
    }
  }
  if (/\.env$/.test(rel) || /(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{8,}/i.test(text)) {
    if (/change-me|example|abc123|not-for-production|AAAA/.test(text)) {
      return 'TEST_FIXTURE';
    }
    return 'REAL_SECRET';
  }
  return 'UNKNOWN';
}

function shouldAllowlist(filePath, line) {
  const classified = classifySecretHit(filePath, line);
  return {
    class: classified,
    allow: classified === 'SECURITY_DETECTION_REGEX' || classified === 'GENERATED_ECC_SECURITY_RULE' || classified === 'TEST_FIXTURE',
  };
}

function formatAllowlistEntry(filePath, substring) {
  return `${filePath}\t${substring}`;
}

module.exports = {
  classifySecretHit,
  shouldAllowlist,
  formatAllowlistEntry,
};
