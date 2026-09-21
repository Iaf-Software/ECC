'use strict';

const fs = require('fs');
const path = require('path');
const { iafRoot } = require('./paths');

const INVENTORY_CLASSIFICATION = 'IAF_FLEET_DATA';

function defaultInventoryPath() {
  return path.join(iafRoot(), 'operator', 'fleet.inventory.json');
}

function resolveInventoryPath(options = {}) {
  if (options.inventoryPath) {
    return path.resolve(options.inventoryPath);
  }
  if (process.env.IAF_FLEET_INVENTORY) {
    return path.resolve(process.env.IAF_FLEET_INVENTORY);
  }
  const fallback = defaultInventoryPath();
  return fs.existsSync(fallback) ? fallback : null;
}

function validateInventory(data, source) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw Object.assign(new Error('Fleet inventory must be a JSON object'), { code: 'IAF_INVENTORY_INVALID' });
  }
  const projects = Array.isArray(data.projects) ? data.projects : [];
  for (const project of projects) {
    if (!project || typeof project.id !== 'string' || !project.id.trim()) {
      throw Object.assign(new Error(`Fleet inventory ${source} contains an entry without id`), { code: 'IAF_INVENTORY_INVALID' });
    }
    if (project.pathHints && !Array.isArray(project.pathHints)) {
      throw Object.assign(new Error(`Fleet inventory ${project.id} pathHints must be an array`), { code: 'IAF_INVENTORY_INVALID' });
    }
  }
  return {
    classification: data.classification || INVENTORY_CLASSIFICATION,
    version: data.version || 1,
    source,
    projects,
  };
}

function loadInventory(options = {}) {
  const file = resolveInventoryPath(options);
  if (!file) {
    return {
      classification: INVENTORY_CLASSIFICATION,
      version: 1,
      source: null,
      projects: [],
    };
  }
  if (!fs.existsSync(file)) {
    const error = new Error(`Fleet inventory not found: ${file}`);
    error.code = 'IAF_INVENTORY_NOT_FOUND';
    throw error;
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return validateInventory(parsed, file);
}

function scanGitRepositories(scanRoots, options = {}) {
  const found = [];
  const maxDepth = Number(options.maxDepth || 3);
  const seen = new Set();

  function walk(dirPath, depth) {
    if (depth > maxDepth || !fs.existsSync(dirPath)) {
      return;
    }
    let stat;
    try {
      stat = fs.statSync(dirPath);
    } catch {
      return;
    }
    if (!stat.isDirectory()) {
      return;
    }
    const real = fs.realpathSync(dirPath);
    if (seen.has(real)) {
      return;
    }
    seen.add(real);
    if (fs.existsSync(path.join(dirPath, '.git'))) {
      found.push({
        id: path.basename(dirPath),
        pathHints: [dirPath],
        discovered: true,
      });
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      walk(path.join(dirPath, entry.name), depth + 1);
    }
  }

  for (const root of scanRoots || []) {
    walk(path.resolve(root), 0);
  }
  return {
    classification: INVENTORY_CLASSIFICATION,
    version: 1,
    source: 'scan',
    projects: found,
  };
}

module.exports = {
  INVENTORY_CLASSIFICATION,
  defaultInventoryPath,
  resolveInventoryPath,
  loadInventory,
  validateInventory,
  scanGitRepositories,
};
