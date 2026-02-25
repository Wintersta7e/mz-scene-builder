// ============================================
// MZ Format Conversion Functions
// Extracted from main.js for testability
// ============================================

const path = require('path');

/**
 * Security: Validate that a path doesn't escape the base directory
 * @param {string} basePath - The base directory path
 * @param {string} requestedPath - The path to validate
 * @returns {boolean} True if path is safe (within base), false otherwise
 */
function isPathSafe(basePath, requestedPath) {
  const resolvedPath = path.resolve(basePath, requestedPath);
  const resolvedBase = path.resolve(basePath);
  // Add trailing separator to both paths to prevent prefix attacks
  // e.g., /pictures-malicious shouldn't match /pictures
  const normalizedPath = resolvedPath + path.sep;
  const normalizedBase = resolvedBase + path.sep;
  return normalizedPath.startsWith(normalizedBase);
}

/**
 * Convert timeline events to RPG Maker MZ format
 * @param {Array} events - Array of timeline events
 * @returns {Array} Array of MZ command objects
 */
function convertToMZFormat(events) {
  const mzCommands = [];

  for (const evt of events) {
    switch (evt.type) {
      case 'showPicture':
        mzCommands.push({
          code: 231,
          indent: 0,
          parameters: [
            evt.pictureNumber || 1,        // Picture Number
            evt.imageName || '',           // Image path
            evt.origin || 0,               // Origin (0=upper-left, 1=center)
            evt.positionType || 0,         // Position type (0=direct, 1=variables)
            evt.x || 0,                    // X position
            evt.y || 0,                    // Y position
            evt.scaleX || 100,             // Scale X %
            evt.scaleY || 100,             // Scale Y %
            evt.opacity || 255,            // Opacity
            evt.blend || 0                 // Blend mode
          ]
        });
        break;

      case 'movePicture':
        mzCommands.push({
          code: 232,
          indent: 0,
          parameters: [
            evt.pictureNumber || 1,
            0, // unused
            evt.origin || 0,
            evt.positionType || 0,
            evt.x || 0,
            evt.y || 0,
            evt.scaleX || 100,
            evt.scaleY || 100,
            evt.opacity || 255,
            evt.blend || 0,
            evt.duration || 60,
            evt.wait || false,
            evt.easingType || 0
          ]
        });
        break;

      case 'rotatePicture':
        mzCommands.push({
          code: 233,
          indent: 0,
          parameters: [evt.pictureNumber || 1, evt.speed || 0]
        });
        break;

      case 'tintPicture':
        mzCommands.push({
          code: 234,
          indent: 0,
          parameters: [
            evt.pictureNumber || 1,
            [evt.red || 0, evt.green || 0, evt.blue || 0, evt.gray || 0],
            evt.duration || 60,
            evt.wait !== false
          ]
        });
        break;

      case 'erasePicture':
        mzCommands.push({
          code: 235,
          indent: 0,
          parameters: [evt.pictureNumber || 1]
        });
        break;

      case 'showText':
        // Show Text command (face, position, background)
        mzCommands.push({
          code: 101,
          indent: 0,
          parameters: [
            evt.faceName || '',
            evt.faceIndex ?? 0,
            evt.background ?? 0,           // 0=window, 1=dim, 2=transparent
            evt.position ?? 2              // 0=top, 1=middle, 2=bottom
          ]
        });
        // Text content lines
        const lines = (evt.text || '').split('\n');
        for (const line of lines) {
          mzCommands.push({
            code: 401,
            indent: 0,
            parameters: [line]
          });
        }
        break;

      case 'wait':
        mzCommands.push({
          code: 230,
          indent: 0,
          parameters: [evt.frames || 60]
        });
        break;

      case 'screenFlash':
        mzCommands.push({
          code: 224,
          indent: 0,
          parameters: [
            [evt.red ?? 255, evt.green ?? 255, evt.blue ?? 255, evt.intensity ?? 170],
            evt.duration || 8,
            evt.wait ?? true
          ]
        });
        break;
    }
  }

  // Note: Don't add terminating command (code 0) - it's only needed for complete event lists
  // When pasting into existing events, RPG Maker handles this automatically

  return mzCommands;
}

module.exports = { convertToMZFormat, isPathSafe };
