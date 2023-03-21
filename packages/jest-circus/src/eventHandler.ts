/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Abq from '@rwx-research/abq';
import type {Status} from '@jest/test-result';
import type {Circus, TestResult} from '@jest/types';
import {
  formatResultsErrors,
  getStackTraceLines,
  separateMessageFromStack,
} from 'jest-message-util';
import {idOfTest} from './abqUtils';
import {
  injectGlobalErrorHandlers,
  restoreGlobalErrorHandlers,
} from './globalErrorHandlers';
import {ROOT_DESCRIBE_BLOCK_NAME} from './state';
import {LOG_ERRORS_BEFORE_RETRY, TEST_TIMEOUT_SYMBOL} from './types';
import {
  addErrorToEachTestUnderDescribe,
  describeBlockHasTests,
  getNanosDuration,
  getTestDuration,
  invariant,
  makeDescribe,
  makeSingleTestResult,
  makeTest,
  nanosNow,
} from './utils';

const eventHandler: Circus.EventHandler = async (event, state) => {
  switch (event.name) {
    case 'include_test_location_in_result': {
      state.includeTestLocationInResult = true;
      break;
    }
    case 'hook_start': {
      event.hook.seenDone = false;
      break;
    }
    case 'start_describe_definition': {
      const {blockName, mode} = event;
      const {currentDescribeBlock, currentlyRunningTest} = state;

      if (currentlyRunningTest) {
        currentlyRunningTest.errors.push(
          new Error(
            `Cannot nest a describe inside a test. Describe block "${blockName}" cannot run because it is nested within "${currentlyRunningTest.name}".`,
          ),
        );
        break;
      }

      const describeBlock = makeDescribe(
        blockName,
        currentDescribeBlock.children.length,
        currentDescribeBlock,
        mode,
      );
      currentDescribeBlock.children.push(describeBlock);
      state.currentDescribeBlock = describeBlock;
      break;
    }
    case 'finish_describe_definition': {
      const {currentDescribeBlock} = state;
      invariant(currentDescribeBlock, 'currentDescribeBlock must be there');

      if (!describeBlockHasTests(currentDescribeBlock)) {
        currentDescribeBlock.hooks.forEach(hook => {
          hook.asyncError.message = `Invalid: ${hook.type}() may not be used in a describe block containing no tests.`;
          state.unhandledErrors.push(hook.asyncError);
        });
      }

      // pass mode of currentDescribeBlock to tests
      // but do not when there is already a single test with "only" mode
      const shouldPassMode = !(
        currentDescribeBlock.mode === 'only' &&
        currentDescribeBlock.children.some(
          child => child.type === 'test' && child.mode === 'only',
        )
      );
      if (shouldPassMode) {
        currentDescribeBlock.children.forEach(child => {
          if (child.type === 'test' && !child.mode) {
            child.mode = currentDescribeBlock.mode;
          }
        });
      }
      if (
        !state.hasFocusedTests &&
        currentDescribeBlock.mode !== 'skip' &&
        currentDescribeBlock.children.some(
          child => child.type === 'test' && child.mode === 'only',
        )
      ) {
        state.hasFocusedTests = true;
      }

      if (currentDescribeBlock.parent) {
        state.currentDescribeBlock = currentDescribeBlock.parent;
      }
      break;
    }
    case 'add_hook': {
      const {currentDescribeBlock, currentlyRunningTest, hasStarted} = state;
      const {asyncError, fn, hookType: type, timeout} = event;

      if (currentlyRunningTest) {
        currentlyRunningTest.errors.push(
          new Error(
            `Hooks cannot be defined inside tests. Hook of type "${type}" is nested within "${currentlyRunningTest.name}".`,
          ),
        );
        break;
      } else if (hasStarted) {
        state.unhandledErrors.push(
          new Error(
            'Cannot add a hook after tests have started running. Hooks must be defined synchronously.',
          ),
        );
        break;
      }
      const parent = currentDescribeBlock;

      currentDescribeBlock.hooks.push({
        asyncError,
        fn,
        parent,
        seenDone: false,
        timeout,
        type,
      });
      break;
    }
    case 'add_test': {
      const {currentDescribeBlock, currentlyRunningTest, hasStarted} = state;
      const {
        asyncError,
        fn,
        mode,
        testName: name,
        timeout,
        concurrent,
        failing,
      } = event;

      if (currentlyRunningTest) {
        currentlyRunningTest.errors.push(
          new Error(
            `Tests cannot be nested. Test "${name}" cannot run because it is nested within "${currentlyRunningTest.name}".`,
          ),
        );
        break;
      } else if (hasStarted) {
        state.unhandledErrors.push(
          new Error(
            'Cannot add a test after tests have started running. Tests must be defined synchronously.',
          ),
        );
        break;
      }

      const test = makeTest(
        fn,
        mode,
        concurrent,
        name,
        currentDescribeBlock,
        currentDescribeBlock.children.length,
        timeout,
        asyncError,
        failing,
      );
      if (currentDescribeBlock.mode !== 'skip' && test.mode === 'only') {
        state.hasFocusedTests = true;
      }
      currentDescribeBlock.children.push(test);
      currentDescribeBlock.tests.push(test);
      break;
    }
    case 'hook_failure': {
      const {test, describeBlock, error, hook} = event;
      const {asyncError, type} = hook;

      if (type === 'beforeAll') {
        invariant(describeBlock, 'always present for `*All` hooks');
        addErrorToEachTestUnderDescribe(describeBlock, error, asyncError);
      } else if (type === 'afterAll') {
        // Attaching `afterAll` errors to each test makes execution flow
        // too complicated, so we'll consider them to be global.
        state.unhandledErrors.push([error, asyncError]);
      } else {
        invariant(test, 'always present for `*Each` hooks');
        test.errors.push([error, asyncError]);
      }
      break;
    }
    case 'test_skip': {
      event.test.durationNanos = getNanosDuration(event.test);
      event.test.status = 'skip';
      if (state.abqSocket) {
        event.test.duration = getTestDuration(event.test);
        await sendAbqTest(state, event.test);
      }
      break;
    }
    case 'test_todo': {
      event.test.durationNanos = getNanosDuration(event.test);
      event.test.status = 'todo';
      if (state.abqSocket) {
        event.test.duration = getTestDuration(event.test);
        await sendAbqTest(state, event.test);
      }
      break;
    }
    case 'test_done': {
      event.test.duration = getTestDuration(event.test);
      event.test.durationNanos = getNanosDuration(event.test);
      event.test.status = 'done';
      if (state.abqSocket) {
        await sendAbqTest(state, event.test);
      }
      state.currentlyRunningTest = null;
      break;
    }
    case 'test_start': {
      state.currentlyRunningTest = event.test;
      event.test.startedAt = Date.now();
      event.test.startedAtNanos = nanosNow();
      event.test.invocations += 1;
      break;
    }
    case 'test_fn_start': {
      event.test.seenDone = false;
      break;
    }
    case 'test_fn_failure': {
      const {
        error,
        test: {asyncError},
      } = event;
      event.test.errors.push([error, asyncError]);
      break;
    }
    case 'test_retry': {
      const logErrorsBeforeRetry: boolean =
        // eslint-disable-next-line no-restricted-globals
        global[LOG_ERRORS_BEFORE_RETRY] || false;
      if (logErrorsBeforeRetry) {
        event.test.retryReasons.push(...event.test.errors);
      }
      event.test.errors = [];
      break;
    }
    case 'run_start': {
      state.hasStarted = true;
      /* eslint-disable no-restricted-globals */
      global[TEST_TIMEOUT_SYMBOL] &&
        (state.testTimeout = global[TEST_TIMEOUT_SYMBOL]);
      /* eslint-enable */
      break;
    }
    case 'run_finish': {
      break;
    }
    case 'setup': {
      // Uncaught exception handlers should be defined on the parent process
      // object. If defined on the VM's process object they just no op and let
      // the parent process crash. It might make sense to return a `dispatch`
      // function to the parent process and register handlers there instead, but
      // i'm not sure if this is works. For now i just replicated whatever
      // jasmine was doing -- dabramov
      state.parentProcess = event.parentProcess;
      invariant(state.parentProcess);
      state.originalGlobalErrorHandlers = injectGlobalErrorHandlers(
        state.parentProcess,
      );
      if (event.testNamePattern) {
        state.testNamePattern = new RegExp(event.testNamePattern, 'i');
      }
      state.config = event.config;
      state.globalConfig = event.globalConfig;
      state.testPath = event.testPath;

      if (event.abqConfig) {
        state.abqSocket = event.abqConfig.socket;

        if (
          event.abqConfig.focus &&
          event.abqConfig.focus.test_ids.length > 1
        ) {
          state.abqFocusTestIds = event.abqConfig.focus.test_ids;
        }
      } else {
        state.abqSocket = null;
        state.abqFocusTestIds = null;
      }

      if (state.abqSocket) {
        state.includeTestLocationInResult = true;
      }
      break;
    }
    case 'teardown': {
      invariant(state.originalGlobalErrorHandlers);
      invariant(state.parentProcess);
      restoreGlobalErrorHandlers(
        state.parentProcess,
        state.originalGlobalErrorHandlers,
      );
      // Don't leak the config handles
      state.config = null;
      state.globalConfig = null;
      state.testPath = null;
      state.abqSocket = null;
      break;
    }
    case 'error': {
      // It's very likely for long-running async tests to throw errors. In this
      // case we want to catch them and fail the current test. At the same time
      // there's a possibility that one test sets a long timeout, that will
      // eventually throw after this test finishes but during some other test
      // execution, which will result in one test's error failing another test.
      // In any way, it should be possible to track where the error was thrown
      // from.
      state.currentlyRunningTest
        ? state.currentlyRunningTest.errors.push(event.error)
        : state.unhandledErrors.push(event.error);
      break;
    }
  }
};

async function sendAbqTest(state: Circus.State, test: Circus.TestEntry) {
  if (test.skippedDueToAbqFocus) {
    // This test was skipped and is irrelevant due to a configured focus; don't
    // send any information for it.
    return;
  }

  const result = formatAbqTestResult(state, test);
  const msg: Abq.IncrementalTestResultStep = {
    one_test_result: result,
    type: 'incremental_result',
  };
  await Abq.protocolWrite(state.abqSocket!, msg);
}

function formatAbqStatus(
  state: Circus.State,
  status: TestResult.AssertionResult['status'],
  failureMessages: Array<string>,
): Abq.TestResultStatus {
  switch (status) {
    case 'passed': {
      return {type: 'success'};
    }
    case 'failed': {
      if (failureMessages.length === 0) {
        return {
          type: 'failure',
        };
      }
      const backtraces: Array<string> = [];
      let exceptions = '';
      for (const errorAndBt of failureMessages) {
        const {message, stack} = separateMessageFromStack(errorAndBt);
        const optnewline = exceptions.length === 0 ? '' : '\n';
        exceptions += `${optnewline}${message}`;

        const stackTraceLines = getStackTraceLines(stack, state.globalConfig!);
        if (backtraces.length > 0) {
          backtraces.push('\n');
        }
        for (const stackTraceLine of stackTraceLines) {
          // The formatter might keep around leading whitespace or empty lines;
          // drop those.
          const stLine = stackTraceLine.trimLeft();
          if (stLine.length > 0) {
            backtraces.push(stLine);
          }
        }
      }
      return {
        backtrace: backtraces,
        exception: exceptions,
        type: 'failure',
      };
    }
    case 'pending': {
      return {type: 'pending'};
    }
    case 'skipped': {
      return {type: 'skipped'};
    }
    case 'todo': {
      return {type: 'todo'};
    }
    case 'disabled': {
      return {type: 'skipped'};
    }
    default: {
      throw new Error(`Unexpected test status: ${status}`);
    }
  }
}

function formatAbqLocation(
  fileName: string,
  callsite: NonNullable<TestResult.AssertionResult['location']>,
): Required<Abq.Location> {
  return {
    column: callsite.column,
    file: fileName,
    line: callsite.line,
  };
}

function formatAbqTestResult(
  state: Circus.State,
  testEntry: Circus.TestEntry,
): Abq.TestResult {
  const testResult = toSingleJestAssertionResult(
    makeSingleTestResult(testEntry),
  );

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    ancestorTitles,
    failureDetails: _failureDetails,
    failureMessages,
    fullName,
    location: callsite,
    numPassingAsserts: _numPassingAsserts,
    retryReasons: _retryReasons,
    status: jestStatus,
    title: _title,
  } = testResult;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const runtime = testEntry.durationNanos ?? 0;

  // We force both the test path and call site to be populated when setting up
  // the state.
  const location = formatAbqLocation(state.testPath!, callsite!);
  const status = formatAbqStatus(state, jestStatus, failureMessages);

  const output = formatResultsErrors(
    [testResult],
    // XREF jestAdapterInit's calling of formatResultsErrors
    state.config!,
    state.globalConfig!,
    state.testPath!,
  );

  return {
    display_name: fullName,
    id: idOfTest(state, testEntry),
    lineage: ancestorTitles,
    location,
    meta: {},
    output,
    runtime,
    status,
  };
}

function toSingleJestAssertionResult(
  testResult: Circus.TestResult,
): TestResult.AssertionResult {
  let status: Status;
  if (testResult.status === 'skip') {
    status = 'pending';
  } else if (testResult.status === 'todo') {
    status = 'todo';
  } else if (testResult.errors.length) {
    status = 'failed';
  } else {
    status = 'passed';
  }

  const ancestorTitles = testResult.testPath.filter(
    name => name !== ROOT_DESCRIBE_BLOCK_NAME,
  );
  const title = ancestorTitles.pop();

  return {
    ancestorTitles,
    duration: testResult.duration,
    failureDetails: testResult.errorsDetailed,
    failureMessages: testResult.errors,
    fullName: title
      ? ancestorTitles.concat(title).join(' ')
      : ancestorTitles.join(' '),
    invocations: testResult.invocations,
    location: testResult.location,
    numPassingAsserts: 0,
    retryReasons: testResult.retryReasons,
    status,
    title: testResult.testPath[testResult.testPath.length - 1],
  };
}

export default eventHandler;
