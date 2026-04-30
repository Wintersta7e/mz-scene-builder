// ============================================
// Main Process Utilities
// ============================================

const fsPromises = require('node:fs').promises;

async function pathExists(p) {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

module.exports = { pathExists };
