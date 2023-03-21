/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import pLimit = require('p-limit');
import type {Circus} from '@jest/types';
import * as abqUtils from './abqUtils';
import {dispatch, getState} from './state';
import {RETRY_TIMES} from './types';
import {
  callAsyncCircusFn,
  getAllHooksForDescribe,
  getEachHooksForTest,
  getTestID,
  invariant,
  makeRunResult,
} from './utils';

const run = async (): Promise<Circus.RunResult> => {
  const {rootDescribeBlock} = getState();
  await dispatch({name: 'run_start'});
  await _runTestsForDescribeBlock(rootDescribeBlock, true);
  await dispatch({name: 'run_finish'});
  return makeRunResult(
    getState().rootDescribeBlock,
    getState().unhandledErrors,
  );
};

const _runTestsForDescribeBlock = async (
  describeBlock: Circus.DescribeBlock,
  isRootBlock = false,
) => {
  await dispatch({describeBlock, name: 'run_describe_start'});
  const {beforeAll, afterAll} = getAllHooksForDescribe(describeBlock);

  const isSkipped = describeBlock.mode === 'skip';

  if (!isSkipped) {
    for (const hook of beforeAll) {
      await _callCircusHook({describeBlock, hook});
    }
  }

  if (isRootBlock) {
    const concurrentTests = collectConcurrentTests(describeBlock);
    const mutex = pLimit(getState().maxConcurrency);
    for (const test of concurrentTests) {
      try {
        const promise = mutex(test.fn);
        // Avoid triggering the uncaught promise rejection handler in case the
        // test errors before being awaited on.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        promise.catch(() => {});
        test.fn = () => promise;
      } catch (err) {
        test.fn = () => {
          throw err;
        };
      }
    }
  }

  // Tests that fail and are retried we run after other tests
  // eslint-disable-next-line no-restricted-globals
  const retryTimes = parseInt(global[RETRY_TIMES], 10) || 0;
  const deferredRetryTests = [];

  for (const child of describeBlock.children) {
    switch (child.type) {
      case 'describeBlock': {
        await _runTestsForDescribeBlock(child);
        break;
      }
      case 'test': {
        const hasErrorsBeforeTestRun = child.errors.length > 0;
        await _runTest(child, isSkipped);

        if (
          hasErrorsBeforeTestRun === false &&
          retryTimes > 0 &&
          child.errors.length > 0
        ) {
          deferredRetryTests.push(child);
        }
        break;
      }
    }
  }

  // Re-run failed tests n-times if configured
  for (const test of deferredRetryTests) {
    let numRetriesAvailable = retryTimes;

    while (numRetriesAvailable > 0 && test.errors.length > 0) {
      // Clear errors so retries occur
      await dispatch({name: 'test_retry', test});

      await _runTest(test, isSkipped);
      numRetriesAvailable--;
    }
  }

  if (!isSkipped) {
    for (const hook of afterAll) {
      await _callCircusHook({describeBlock, hook});
    }
  }

  await dispatch({describeBlock, name: 'run_describe_finish'});
};

function collectConcurrentTests(
  describeBlock: Circus.DescribeBlock,
): Array<Omit<Circus.TestEntry, 'fn'> & {fn: Circus.ConcurrentTestFn}> {
  if (describeBlock.mode === 'skip') {
    return [];
  }
  const {hasFocusedTests, testNamePattern} = getState();
  return describeBlock.children.flatMap(child => {
    switch (child.type) {
      case 'describeBlock':
        return collectConcurrentTests(child);
      case 'test':
        const skip =
          !child.concurrent ||
          child.mode === 'skip' ||
          (hasFocusedTests && child.mode !== 'only') ||
          (testNamePattern && !testNamePattern.test(getTestID(child)));
        return skip
          ? []
          : [child as Circus.TestEntry & {fn: Circus.ConcurrentTestFn}];
    }
  });
}

const _runTest = async (
  test: Circus.TestEntry,
  parentSkipped: boolean,
): Promise<void> => {
  await dispatch({name: 'test_start', test});
  const testContext = Object.create(null);

  const state = getState();
  const {hasFocusedTests, testNamePattern} = state;

  let isSkippedForAbq = false;
  if (state.abqFocusTestIds && state.abqFocusTestIds.length > 0) {
    const testId = abqUtils.idOfTest(state, test);
    if (!state.abqFocusTestIds.includes(testId)) {
      isSkippedForAbq = true;
    }
  }

  const isSkipped =
    parentSkipped ||
    test.mode === 'skip' ||
    isSkippedForAbq ||
    (hasFocusedTests && test.mode === undefined) ||
    (testNamePattern && !testNamePattern.test(getTestID(test)));

  if (isSkipped) {
    test.skippedDueToAbqFocus = isSkippedForAbq;
    await dispatch({name: 'test_skip', test});
    return;
  }

  if (test.mode === 'todo') {
    await dispatch({name: 'test_todo', test});
    return;
  }

  const {afterEach, beforeEach} = getEachHooksForTest(test);

  for (const hook of beforeEach) {
    if (test.errors.length) {
      // If any of the before hooks failed already, we don't run any
      // hooks after that.
      break;
    }
    await _callCircusHook({hook, test, testContext});
  }

  await _callCircusTest(test, testContext);

  for (const hook of afterEach) {
    await _callCircusHook({hook, test, testContext});
  }

  // `afterAll` hooks should not affect test status (pass or fail), because if
  // we had a global `afterAll` hook it would block all existing tests until
  // this hook is executed. So we dispatch `test_done` right away.
  await dispatch({name: 'test_done', test});
};

const _callCircusHook = async ({
  hook,
  test,
  describeBlock,
  testContext = {},
}: {
  hook: Circus.Hook;
  describeBlock?: Circus.DescribeBlock;
  test?: Circus.TestEntry;
  testContext?: Circus.TestContext;
}): Promise<void> => {
  await dispatch({hook, name: 'hook_start'});
  const timeout = hook.timeout || getState().testTimeout;

  try {
    await callAsyncCircusFn(hook, testContext, {
      isHook: true,
      timeout,
    });
    await dispatch({describeBlock, hook, name: 'hook_success', test});
  } catch (error) {
    await dispatch({describeBlock, error, hook, name: 'hook_failure', test});
  }
};

const _callCircusTest = async (
  test: Circus.TestEntry,
  testContext: Circus.TestContext,
): Promise<void> => {
  await dispatch({name: 'test_fn_start', test});
  const timeout = test.timeout || getState().testTimeout;
  invariant(test.fn, "Tests with no 'fn' should have 'mode' set to 'skipped'");

  if (test.errors.length) {
    return; // We don't run the test if there's already an error in before hooks.
  }

  try {
    await callAsyncCircusFn(test, testContext, {
      isHook: false,
      timeout,
    });
    if (test.failing) {
      test.asyncError.message =
        'Failing test passed even though it was supposed to fail. Remove `.failing` to remove error.';
      await dispatch({
        error: test.asyncError,
        name: 'test_fn_failure',
        test,
      });
    } else {
      await dispatch({name: 'test_fn_success', test});
    }
  } catch (error) {
    if (test.failing) {
      await dispatch({name: 'test_fn_success', test});
    } else {
      await dispatch({error, name: 'test_fn_failure', test});
    }
  }
};

export default run;
