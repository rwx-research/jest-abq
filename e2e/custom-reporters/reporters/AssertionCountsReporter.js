/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

class AssertionCountsReporter {
  onTestFileResult(test, testResult, aggregatedResult) {
    testResult.testResults.forEach((testCaseResult, index) => {
      console.log(
        `onTestFileResult testCaseResult ${index}: ${testCaseResult.title}, ` +
          `status: ${testCaseResult.status}, ` +
          `numExpectations: ${testCaseResult.numPassingAsserts}`,
      );
    });
  }
  onTestCaseResult(test, testCaseResult) {
    console.log(
      `onTestCaseResult: ${testCaseResult.title}, ` +
        `status: ${testCaseResult.status}, ` +
        `numExpectations: ${testCaseResult.numPassingAsserts}`,
    );
  }
}

module.exports = AssertionCountsReporter;
