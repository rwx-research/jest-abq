/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

jest.mock('../');

const importedFn = require('../');
const localFn = jest.fn();

describe('without an explicit reset', () => {
  test('first test', () => {
    importedFn();
    localFn();

    expect(importedFn).toHaveBeenCalledTimes(1);
    expect(localFn).toHaveBeenCalledTimes(1);
  });

  test('second test', () => {
    importedFn();
    localFn();

    expect(importedFn).toHaveBeenCalledTimes(2);
    expect(localFn).toHaveBeenCalledTimes(2);
  });
});

describe('with an explicit reset', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('first test', () => {
    importedFn();
    localFn();

    expect(importedFn).toHaveBeenCalledTimes(1);
    expect(localFn).toHaveBeenCalledTimes(1);
  });

  test('second test', () => {
    importedFn();
    localFn();

    expect(importedFn).toHaveBeenCalledTimes(1);
    expect(localFn).toHaveBeenCalledTimes(1);
  });
});
