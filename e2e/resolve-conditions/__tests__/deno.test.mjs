/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @jest-environment <rootDir>/deno-env.js
 */

import {fn} from 'fake-dual-dep';

test('returns correct message', () => {
  expect(fn()).toBe('hello from deno');
});
