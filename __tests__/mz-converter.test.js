const { convertToMZFormat, isPathSafe } = require('../src/lib/mz-converter');
const path = require('path');

describe('convertToMZFormat', () => {
  describe('showPicture (code 231)', () => {
    it('converts showPicture with all properties', () => {
      const events = [
        {
          type: 'showPicture',
          pictureNumber: 5,
          imageName: 'characters/mika/pose1',
          origin: 1,
          positionType: 0,
          x: 960,
          y: 540,
          scaleX: 100,
          scaleY: 100,
          opacity: 255,
          blend: 0
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 231,
        indent: 0,
        parameters: [5, 'characters/mika/pose1', 1, 0, 960, 540, 100, 100, 255, 0]
      });
    });

    it('uses defaults for missing properties', () => {
      const events = [{ type: 'showPicture' }];

      const result = convertToMZFormat(events);

      expect(result[0].parameters).toEqual([1, '', 0, 0, 0, 0, 100, 100, 255, 0]);
    });
  });

  describe('movePicture (code 232)', () => {
    it('converts movePicture with all properties', () => {
      const events = [
        {
          type: 'movePicture',
          pictureNumber: 3,
          origin: 1,
          positionType: 0,
          x: 100,
          y: 200,
          scaleX: 150,
          scaleY: 150,
          opacity: 128,
          blend: 1,
          duration: 30,
          wait: true,
          easingType: 2
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 232,
        indent: 0,
        parameters: [3, 0, 1, 0, 100, 200, 150, 150, 128, 1, 30, true, 2]
      });
    });

    it('uses defaults for missing properties', () => {
      const events = [{ type: 'movePicture' }];

      const result = convertToMZFormat(events);

      // Parameters: [pictureNumber, unused, origin, positionType, x, y, scaleX, scaleY, opacity, blend, duration, wait, easingType]
      expect(result[0].parameters).toEqual([1, 0, 0, 0, 0, 0, 100, 100, 255, 0, 60, false, 0]);
    });
  });

  describe('rotatePicture (code 233)', () => {
    it('converts rotatePicture with speed', () => {
      const events = [
        {
          type: 'rotatePicture',
          pictureNumber: 2,
          speed: 5
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 233,
        indent: 0,
        parameters: [2, 5]
      });
    });

    it('uses defaults for missing properties', () => {
      const events = [{ type: 'rotatePicture' }];

      const result = convertToMZFormat(events);

      expect(result[0].parameters).toEqual([1, 0]);
    });
  });

  describe('tintPicture (code 234)', () => {
    it('converts tintPicture with color values', () => {
      const events = [
        {
          type: 'tintPicture',
          pictureNumber: 4,
          red: 100,
          green: -50,
          blue: 0,
          gray: 128,
          duration: 45,
          wait: false
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 234,
        indent: 0,
        parameters: [4, [100, -50, 0, 128], 45, false]
      });
    });

    it('defaults wait to true when not specified', () => {
      const events = [
        {
          type: 'tintPicture',
          pictureNumber: 1
        }
      ];

      const result = convertToMZFormat(events);

      // wait !== false evaluates to true when wait is undefined
      expect(result[0].parameters[3]).toBe(true);
    });

    it('uses defaults for missing properties', () => {
      const events = [{ type: 'tintPicture' }];

      const result = convertToMZFormat(events);

      expect(result[0].parameters).toEqual([1, [0, 0, 0, 0], 60, true]);
    });
  });

  describe('erasePicture (code 235)', () => {
    it('converts erasePicture', () => {
      const events = [
        {
          type: 'erasePicture',
          pictureNumber: 7
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 235,
        indent: 0,
        parameters: [7]
      });
    });

    it('uses default picture number', () => {
      const events = [{ type: 'erasePicture' }];

      const result = convertToMZFormat(events);

      expect(result[0].parameters).toEqual([1]);
    });
  });

  describe('showText (code 101 + 401)', () => {
    it('converts single line text', () => {
      const events = [
        {
          type: 'showText',
          faceName: 'Actor1',
          faceIndex: 2,
          background: 1,
          position: 0,
          text: 'Hello, world!'
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 101,
        indent: 0,
        parameters: ['Actor1', 2, 1, 0]
      });
      expect(result[1]).toEqual({
        code: 401,
        indent: 0,
        parameters: ['Hello, world!']
      });
    });

    it('converts multiline text', () => {
      const events = [
        {
          type: 'showText',
          text: 'Line 1\nLine 2\nLine 3'
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(4); // 1 header + 3 lines
      expect(result[0].code).toBe(101);
      expect(result[1]).toEqual({ code: 401, indent: 0, parameters: ['Line 1'] });
      expect(result[2]).toEqual({ code: 401, indent: 0, parameters: ['Line 2'] });
      expect(result[3]).toEqual({ code: 401, indent: 0, parameters: ['Line 3'] });
    });

    it('uses defaults for missing properties', () => {
      const events = [{ type: 'showText' }];

      const result = convertToMZFormat(events);

      expect(result[0].parameters).toEqual(['', 0, 0, 2]); // default position is 2 (bottom)
      expect(result[1].parameters).toEqual(['']); // empty text line
    });

    it('handles empty text', () => {
      const events = [
        {
          type: 'showText',
          text: ''
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(2);
      expect(result[1].parameters).toEqual(['']);
    });
  });

  describe('wait (code 230)', () => {
    it('converts wait with frames', () => {
      const events = [
        {
          type: 'wait',
          frames: 120
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 230,
        indent: 0,
        parameters: [120]
      });
    });

    it('uses default frames', () => {
      const events = [{ type: 'wait' }];

      const result = convertToMZFormat(events);

      expect(result[0].parameters).toEqual([60]);
    });
  });

  describe('screenFlash (code 224)', () => {
    it('converts screenFlash with all properties', () => {
      const events = [
        {
          type: 'screenFlash',
          red: 255,
          green: 128,
          blue: 64,
          intensity: 200,
          duration: 15,
          wait: false
        }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 224,
        indent: 0,
        parameters: [[255, 128, 64, 200], 15, false]
      });
    });

    it('uses defaults for missing properties', () => {
      const events = [{ type: 'screenFlash' }];

      const result = convertToMZFormat(events);

      expect(result[0].parameters).toEqual([[255, 255, 255, 170], 8, true]);
    });
  });

  describe('multiple events', () => {
    it('converts multiple events in sequence', () => {
      const events = [
        { type: 'showPicture', pictureNumber: 1, imageName: 'bg' },
        { type: 'wait', frames: 30 },
        { type: 'erasePicture', pictureNumber: 1 }
      ];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(3);
      expect(result[0].code).toBe(231);
      expect(result[1].code).toBe(230);
      expect(result[2].code).toBe(235);
    });

    it('returns empty array for empty input', () => {
      const result = convertToMZFormat([]);
      expect(result).toEqual([]);
    });

    it('ignores unknown event types', () => {
      const events = [{ type: 'unknownType' }, { type: 'wait', frames: 30 }];

      const result = convertToMZFormat(events);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe(230);
    });
  });
});

describe('isPathSafe', () => {
  // Use forward slashes for tests to work cross-platform
  const basePath = '/project/img/pictures';

  describe('valid paths', () => {
    it('allows paths within base directory', () => {
      expect(isPathSafe(basePath, 'character/pose1')).toBe(true);
      expect(isPathSafe(basePath, 'background.png')).toBe(true);
      expect(isPathSafe(basePath, 'folder/subfolder/image')).toBe(true);
    });

    it('allows base path itself', () => {
      expect(isPathSafe(basePath, '')).toBe(true);
      expect(isPathSafe(basePath, '.')).toBe(true);
    });

    it('handles paths with spaces', () => {
      expect(isPathSafe(basePath, 'folder name/image name')).toBe(true);
    });
  });

  describe('path traversal attacks', () => {
    it('blocks basic directory traversal', () => {
      expect(isPathSafe(basePath, '../secrets')).toBe(false);
      expect(isPathSafe(basePath, '../../etc/passwd')).toBe(false);
    });

    it('blocks traversal within nested path', () => {
      expect(isPathSafe(basePath, 'folder/../../../secrets')).toBe(false);
      expect(isPathSafe(basePath, 'a/b/c/../../../../d')).toBe(false);
    });

    it('blocks absolute paths outside base', () => {
      expect(isPathSafe(basePath, '/etc/passwd')).toBe(false);
      expect(isPathSafe(basePath, '/root/.ssh/id_rsa')).toBe(false);
    });

    it('blocks double-encoded traversal attempts', () => {
      // These resolve to the actual characters, so path.resolve handles them
      expect(isPathSafe(basePath, '..%2f..%2fetc/passwd')).toBe(true); // Stays as literal string, doesn't escape
    });

    it('blocks access to sibling directories with similar name prefixes', () => {
      // Prevents /pictures-malicious from matching /pictures
      expect(isPathSafe(basePath, '../pictures-malicious/file')).toBe(false);
      expect(isPathSafe(basePath, '../pictures2/file')).toBe(false);
      expect(isPathSafe('/project/img/pictures', '../pictures-other')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles trailing slashes', () => {
      expect(isPathSafe(basePath + '/', 'image')).toBe(true);
    });

    it('handles Windows-style path separators on Windows', () => {
      // path.resolve normalizes these on all platforms
      const winBase = 'C:\\project\\img\\pictures';
      if (path.sep === '\\') {
        expect(isPathSafe(winBase, 'folder\\image')).toBe(true);
        expect(isPathSafe(winBase, '..\\..\\windows\\system32')).toBe(false);
      }
    });

    it('normalizes double slashes', () => {
      expect(isPathSafe(basePath, 'folder//image')).toBe(true);
    });
  });
});
