/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as net from 'net';
import {
  AssertionResult,
  TestResult,
  createEmptyTestResult,
} from '@jest/test-result';
import type {Config} from '@jest/types';
import * as Abq from '@rwx-research/abq';
import {
  formatResultsErrors,
  getStackTraceLines,
  separateMessageFromStack,
} from 'jest-message-util';
import type {SpecResult} from './jasmine/Spec';
import type {SuiteResult} from './jasmine/Suite';
import type {Reporter, RunDetails} from './types';

type Microseconds = number;

export default class Jasmine2Reporter implements Reporter {
  private readonly _testResults: Array<AssertionResult>;
  private readonly _globalConfig: Config.GlobalConfig;
  private readonly _config: Config.ProjectConfig;
  private readonly _currentSuites: Array<string>;
  private _resolve: any;
  private readonly _resultsPromise: Promise<TestResult>;
  private readonly _startTimes: Map<string, Microseconds>;
  private readonly _testPath: string;
  private readonly _abqSocket?: net.Socket;

  constructor(
    globalConfig: Config.GlobalConfig,
    config: Config.ProjectConfig,
    testPath: string,
    abqSocket?: net.Socket,
  ) {
    this._globalConfig = globalConfig;
    this._config = config;
    this._testPath = testPath;
    this._testResults = [];
    this._currentSuites = [];
    this._resolve = null;
    this._resultsPromise = new Promise(resolve => (this._resolve = resolve));
    this._startTimes = new Map();
    this._abqSocket = abqSocket;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  jasmineStarted(_runDetails: RunDetails): void {}

  specStarted(spec: SpecResult): void {
    this._startTimes.set(spec.id, Date.now());
  }

  specDone(result: SpecResult): void {
    const assertionResult = this._extractSpecResults(
      result,
      this._currentSuites.slice(0),
    );
    if (this._abqSocket) {
      sendAbqTest(
        this._config,
        this._globalConfig,
        this._testPath,
        this._abqSocket,
        assertionResult,
      );
    }
    this._testResults.push(assertionResult);
  }

  suiteStarted(suite: SuiteResult): void {
    this._currentSuites.push(suite.description);
  }

  suiteDone(_result: SuiteResult): void {
    this._currentSuites.pop();
  }

  jasmineDone(_runDetails: RunDetails): void {
    let numFailingTests = 0;
    let numPassingTests = 0;
    let numPendingTests = 0;
    let numTodoTests = 0;
    const testResults = this._testResults;
    testResults.forEach(testResult => {
      if (testResult.status === 'failed') {
        numFailingTests++;
      } else if (testResult.status === 'pending') {
        numPendingTests++;
      } else if (testResult.status === 'todo') {
        numTodoTests++;
      } else {
        numPassingTests++;
      }
    });

    const testResult = {
      ...createEmptyTestResult(),
      console: null,
      failureMessage: formatResultsErrors(
        testResults,
        this._config,
        this._globalConfig,
        this._testPath,
      ),
      numFailingTests,
      numPassingTests,
      numPendingTests,
      numTodoTests,
      snapshot: {
        added: 0,
        fileDeleted: false,
        matched: 0,
        unchecked: 0,
        unmatched: 0,
        updated: 0,
      },
      testFilePath: this._testPath,
      testResults,
    };

    this._resolve(testResult);
  }

  getResults(): Promise<TestResult> {
    return this._resultsPromise;
  }

  private _addMissingMessageToStack(stack: string, message?: string) {
    // Some errors (e.g. Angular injection error) don't prepend error.message
    // to stack, instead the first line of the stack is just plain 'Error'
    const ERROR_REGEX = /^Error:?\s*\n/;

    if (stack && message && !stack.includes(message)) {
      return message + stack.replace(ERROR_REGEX, '\n');
    }
    return stack;
  }

  private _extractSpecResults(
    specResult: SpecResult,
    ancestorTitles: Array<string>,
  ): AssertionResult {
    const status =
      specResult.status === 'disabled' ? 'pending' : specResult.status;
    const start = this._startTimes.get(specResult.id);
    const duration =
      start && !['pending', 'skipped'].includes(status)
        ? Date.now() - start
        : null;
    const location = specResult.__callsite
      ? {
          column: specResult.__callsite.getColumnNumber(),
          line: specResult.__callsite.getLineNumber(),
        }
      : null;
    const results: AssertionResult = {
      ancestorTitles,
      duration,
      failureDetails: [],
      failureMessages: [],
      fullName: specResult.fullName,
      location,
      numPassingAsserts: 0, // Jasmine2 only returns an array of failed asserts.
      status,
      title: specResult.description,
    };

    specResult.failedExpectations.forEach(failed => {
      const message =
        !failed.matcherName && typeof failed.stack === 'string'
          ? this._addMissingMessageToStack(failed.stack, failed.message)
          : failed.message || '';
      results.failureMessages.push(message);
      results.failureDetails.push(failed);
    });

    return results;
  }
}

function sendAbqTest(
  config: Config.ProjectConfig,
  globalConfig: Config.GlobalConfig,
  testPath: string,
  abqSocket: net.Socket,
  test: AssertionResult,
) {
  const result = formatAbqTestResult(config, globalConfig, testPath, test);
  const msg = {
    type: 'incremental_result',
    one_test_result: result,
  };
  Abq.protocolWrite(abqSocket, msg as any);
}

function formatAbqStatus(
  globalConfig: Config.GlobalConfig,
  status: AssertionResult['status'],
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

        const stackTraceLines = getStackTraceLines(stack, globalConfig);
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
  }
}

function millisecondToNanosecond(ms: number): number {
  return ms * 1000000;
}

function formatAbqLocation(
  fileName: string,
  callsite: AssertionResult['location'],
): Abq.Location {
  return {
    column: callsite?.column,
    file: fileName,
    line: callsite?.line,
  };
}

function formatAbqTestResult(
  config: Config.ProjectConfig,
  globalConfig: Config.GlobalConfig,
  testPath: string,
  testResult: AssertionResult,
): Abq.TestResult {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    ancestorTitles,
    duration,
    failureDetails: _failureDetails,
    failureMessages,
    fullName,
    location: optCallsite,
    numPassingAsserts: _numPassingAsserts,
    retryReasons: _retryReasons,
    status: jestStatus,
    title: _title,
  } = testResult;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // It appears that jest runners will sometimes report the duration observed
  // for a failure after the first in a file as zero-timed; in these cases,
  // use the estimated runtime.
  const runtime = duration ? millisecondToNanosecond(duration) : 99999999;

  const location = formatAbqLocation(testPath, optCallsite);
  const status = formatAbqStatus(globalConfig, jestStatus, failureMessages);

  const output = formatResultsErrors(
    [testResult],
    // XREF jestAdapterInit's calling of formatResultsErrors
    config,
    globalConfig,
    testPath,
  );

  return {
    display_name: fullName,
    id: fullName,
    lineage: ancestorTitles,
    location,
    meta: {},
    output,
    runtime,
    status,
  };
}
