/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {skipSuiteOnJestCircus} from '@jest/test-utils';
import runJest from '../runJest';

skipSuiteOnJestCircus(); // Circus does not support funky async definitions

describe('Correct beforeEach order', () => {
  it('ensures the correct order for beforeEach', () => {
    const result = runJest('before-each-queue');
    expect(result.stdout.replace(/\\/g, '/')).toMatchSnapshot();
  });
});
