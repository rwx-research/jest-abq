/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

describe('replacePathSepForRegex()', () => {
  let replacePathSepForRegex: (str: string) => string;

  describe('posix', () => {
    beforeAll(() => {
      jest.mock('path', () => ({
        ...jest.createMockFromModule<typeof import('path')>('path'),
        sep: '/',
      }));
      jest.isolateModules(() => {
        replacePathSepForRegex = require('../').replacePathSepForRegex;
      });
    });

    it('should return the path', () => {
      const expected = {};
      expect(replacePathSepForRegex(expected as string)).toBe(expected);
    });
  });

  describe('win32', () => {
    beforeAll(() => {
      jest.mock('path', () => ({
        ...jest.createMockFromModule<typeof import('path')>('path'),
        sep: '\\',
      }));
      jest.isolateModules(() => {
        replacePathSepForRegex = require('../').replacePathSepForRegex;
      });
    });

    it('should replace POSIX path separators', () => {
      expect(replacePathSepForRegex('a/b/c')).toBe('a\\\\b\\\\c');

      // When a regular expression is created with a string, not enclosing
      // slashes like "/<pattern>/", the "/" character does not need to be
      // escaped as "\/". The result is the double path separator: "\\"
      expect(replacePathSepForRegex('a\\/b')).toBe('a\\\\\\\\b');
    });

    it('should escape Windows path separators', () => {
      expect(replacePathSepForRegex('a\\b\\c')).toBe('a\\\\b\\\\c');
    });

    it('should not escape an escaped dot', () => {
      expect(replacePathSepForRegex('a\\.dotfile')).toBe('a\\.dotfile');
      expect(replacePathSepForRegex('a\\\\\\.dotfile')).toBe('a\\\\\\.dotfile');
    });

    it('should not escape an escaped regexp symbol', () => {
      expect(replacePathSepForRegex('b\\(86')).toBe('b\\(86');
    });

    it('should escape Windows path separators inside groups', () => {
      expect(replacePathSepForRegex('[/\\\\]')).toBe('[\\\\\\\\]');
    });

    it('should escape Windows path separator at the beginning', () => {
      expect(replacePathSepForRegex('\\a')).toBe('\\\\a');
    });

    it('should not escape several already escaped path separators', () => {
      expect(replacePathSepForRegex('\\\\\\\\')).toBe('\\\\\\\\');
    });
  });
});
