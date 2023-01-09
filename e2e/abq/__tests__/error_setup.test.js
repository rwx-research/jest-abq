/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

throw new Error("can't catch me");

// eslint-disable-next-line no-unreachable
test('true', () => {
  expect(true).toBe(true);
});
