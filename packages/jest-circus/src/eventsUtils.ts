/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {jestExpect} from '@jest/expect';
import type {Circus} from '@jest/types';

export function jestAdapterEventTestDoneHandler(
  event: Circus.Event & {name: 'test_done'},
): void {
  event.test.numPassingAsserts = jestExpect.getState().numPassingAsserts;
  _addSuppressedErrors(event.test);
  _addExpectedAssertionErrors(event.test);
}

const _addExpectedAssertionErrors = (test: Circus.TestEntry) => {
  const failures = jestExpect.extractExpectedAssertionsErrors();
  const errors = failures.map(failure => failure.error);
  test.errors = test.errors.concat(errors);
};

// Get suppressed errors from ``jest-matchers`` that weren't throw during
// test execution and add them to the test result, potentially failing
// a passing test.
const _addSuppressedErrors = (test: Circus.TestEntry) => {
  const {suppressedErrors} = jestExpect.getState();
  jestExpect.setState({suppressedErrors: []});
  if (suppressedErrors.length) {
    test.errors = test.errors.concat(suppressedErrors);
  }
};
