/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

describe('the + operator', () => {
  test('1 + 2 equals 3', () => {
    expect(1 + 2).toBe(3);
  });

  test('2 + 3 equals 5', () => {
    expect(2 + 3).toBe(5);
  });

  describe('with three operands', () => {
    test('2 + 3 + 4 equals 9', () => {
      expect(2 + 3 + 4).toBe(9);
    });
  });
});
