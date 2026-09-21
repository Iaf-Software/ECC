'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function describeHost() {
  let user = null;
  try {
    user = os.userInfo().username;
  } catch {
    user = process.env.USER || process.env.USERNAME || null;
  }
  return {
    hostname: os.hostname(),
    user,
    cwd: process.cwd(),
    platform: process.platform,
  };
}

function appearsLiveCheckout(repoPath, inventoryEntry = {}) {
  if (inventoryEntry.liveExpected === 'yes') {
    return 'configured-yes';
  }
  if (inventoryEntry.liveExpected === 'no') {
    return 'configured-no';
  }
  const resolved = path.resolve(repoPath);
  const markers = [
    path.join(resolved, 'public'),
    path.join(resolved, 'public_html'),
    path.join(resolved, 'index.php'),
    path.join(resolved, 'artisan'),
  ];
  const hasWebMarker = markers.some(marker => fs.existsSync(marker));
  if (hasWebMarker && inventoryEntry.liveExpected === 'maybe') {
    return 'heuristic-maybe';
  }
  return 'unknown';
}

module.exports = {
  describeHost,
  appearsLiveCheckout,
};
