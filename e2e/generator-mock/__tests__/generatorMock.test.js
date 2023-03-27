/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

jest.mock('../index');

const methods = require('../index');

test('mock works with generator', () => {
  expect(methods.generatorMethod).toBeDefined();
});

test('mock works with asyncGenerator', () => {
  expect(methods.asyncGeneratorMethod).toBeDefined();
});
