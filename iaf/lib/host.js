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
    return 'YES';
  }
  if (inventoryEntry.liveExpected === 'no') {
    return 'NO';
  }
  const resolved = path.resolve(repoPath);
  const markers = [
    path.join(resolved, 'public', 'index.php'),
    path.join(resolved, 'public_html'),
    path.join(resolved, 'index.php'),
    path.join(resolved, 'artisan'),
  ];
  if (markers.some(marker => fs.existsSync(marker))) {
    return 'YES';
  }
  return 'UNKNOWN';
}

module.exports = {
  describeHost,
  appearsLiveCheckout,
};
