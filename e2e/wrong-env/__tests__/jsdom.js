/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @jest-environment jsdom
 */

'use strict';

test('use unref', () => {
  setTimeout(() => {}, 0).unref();

  expect(1).toBe(1);
});
