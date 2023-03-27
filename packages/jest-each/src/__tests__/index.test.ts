/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import each from '../';

describe('array', () => {
  describe('.add', () => {
    each([
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 2],
    ]).test('returns the result of adding %s to %s', (a, b, expected) => {
      expect(a + b).toBe(expected);
    });
  });
});

describe('concurrent', () => {
  describe('.add', () => {
    each([
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 2],
    ]).test.concurrent(
      'returns the result of adding %s to %s',
      async (a, b, expected) => {
        expect(a + b).toBe(expected);
      },
    );
  });
});

describe('template', () => {
  describe('.add', () => {
    each`
      a    | b    | expected
      ${0} | ${0} | ${0}
      ${0} | ${1} | ${1}
      ${1} | ${1} | ${2}
    `.test('returns $expected when given $a and $b', ({a, b, expected}) => {
      expect(a + b).toBe(expected);
    });
  });
});

test('throws an error when not called with the right number of arguments', () => {
  expect(() =>
    each(
      [
        [1, 1, 2],
        [1, 2, 3],
        [2, 1, 3],
      ],
      'seems like a title but should not be here',
      () => {},
    ),
  ).toThrowErrorMatchingSnapshot();
});
