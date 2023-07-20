/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

test('snapshot test success', () => {
expect('A').toMatchInlineSnapshot('"A"');
});

test('snapshot test failure', () => {
  expect('A').toMatchInlineSnapshot('B');
});
