'use strict';

const fs = require('fs');
const path = require('path');

function iafRoot() {
  return path.resolve(__dirname, '..');
}

function eccRoot() {
  return path.resolve(__dirname, '..', '..');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadPolicy(name) {
  return readJson(path.join(iafRoot(), 'policy', name));
}

function iafVersion() {
  return fs.readFileSync(path.join(iafRoot(), 'VERSION'), 'utf8').trim();
}

function packageVersion(root = eccRoot()) {
  const pkg = readJson(path.join(root, 'package.json'));
  return pkg.version;
}

module.exports = {
  iafRoot,
  eccRoot,
  readJson,
  loadPolicy,
  iafVersion,
  packageVersion,
};
