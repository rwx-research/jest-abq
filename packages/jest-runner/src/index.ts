/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import * as Abq from '@rwx-research/abq';
import chalk = require('chalk');
import Emittery = require('emittery');
import pLimit = require('p-limit');
import type {
  Test,
  TestEvents,
  TestFileEvent,
  TestResult,
} from '@jest/test-result';
import type {Config} from '@jest/types';
import {formatExecError} from 'jest-message-util';
import {deepCyclicCopy} from 'jest-util';
import type {TestWatcher} from 'jest-watcher';
import {JestWorkerFarm, PromiseWithCustomMessage, Worker} from 'jest-worker';
import {abqSpawnedMessage} from './abq';
import runTest from './runTest';
import type {SerializableResolver} from './testWorker';
import {
  AbqConfig,
  EmittingTestRunner,
  TestRunnerOptions,
  UnsubscribeFn,
} from './types';

export type {Test, TestEvents} from '@jest/test-result';
export type {Config} from '@jest/types';
export type {TestWatcher} from 'jest-watcher';
export {CallbackTestRunner, EmittingTestRunner} from './types';
export type {
  CallbackTestRunnerInterface,
  EmittingTestRunnerInterface,
  OnTestFailure,
  OnTestStart,
  OnTestSuccess,
  TestRunnerContext,
  TestRunnerOptions,
  JestTestRunner,
  UnsubscribeFn,
} from './types';

type TestWorker = typeof import('./testWorker');

export {abqSpawnedMessage};
const abqConfig = Abq.getAbqConfiguration();

export default class TestRunner extends EmittingTestRunner {
  readonly #eventEmitter = new Emittery<TestEvents>();

  async runTests(
    tests: Array<Test>,
    watcher: TestWatcher,
    options: TestRunnerOptions,
  ): Promise<void> {
    if (abqConfig.enabled) {
      return await this.#createInBandTestRun(tests, watcher);
    }

    return options.serial
      ? this.#createInBandTestRun(tests, watcher)
      : this.#createParallelTestRun(tests, watcher);
  }

  async #createInBandTestRun(tests: Array<Test>, watcher: TestWatcher) {
    process.env.JEST_WORKER_ID = '1';
    const mutex = pLimit(1);

    if (abqConfig.enabled) {
      return this.#createAbqTestRun(tests);
    }

    return tests.reduce(
      (promise, test) =>
        mutex(() =>
          promise.then(async () => {
            if (watcher.isInterrupted()) {
              throw new CancelRun();
            }

            await this.#runInBandTest(test, this._globalConfig);
          }),
        ),
      Promise.resolve(),
    );
  }

  async #runInBandTest(
    test: Test,
    testConfig: Config.GlobalConfig,
    abqConfig?: AbqConfig,
  ): Promise<TestResult> {
    // `deepCyclicCopy` used here to avoid mem-leak
    const sendMessageToJest: TestFileEvent = (eventName, args) =>
      this.#eventEmitter.emit(
        eventName,
        deepCyclicCopy(args, {keepPrototype: false}),
      );

    await this.#eventEmitter.emit('test-file-start', [test]);

    return runTest(
      test.path,
      testConfig,
      test.context.config,
      test.context.resolver,
      this._context,
      sendMessageToJest,
      abqConfig,
    ).then(
      result => {
        this.#eventEmitter.emit('test-file-success', [test, result]);
        return result;
      },
      error => {
        this.#eventEmitter.emit('test-file-failure', [test, error]);
        return error;
      },
    );
  }

  async #createAbqTestRun(tests: Array<Test>): Promise<void> {
    if (!abqConfig.enabled) {
      throw new Error('Cannot create abq test run when abq is disabled');
    }

    function resolveTestPath(testPath: string): string {
      return path.resolve(process.cwd(), testPath);
    }

    return new Promise((resolve, reject) => {
      Abq.connect(abqConfig, abqSpawnedMessage)
        .then(socket => {
          socket.on('close', () => resolve(undefined));
          return socket;
        })
        .then(async socket => {
          Abq.protocolReader(socket, async initOrTestCaseMessage => {
            if ('init_meta' in initOrTestCaseMessage) {
              // This is the initialization message; we don't need it, so just send
              // the success message and move on.
              //
              // If we were told to exit immediately, do that instead.
              const initMsg = initOrTestCaseMessage;
              if (initMsg.fast_exit) {
                socket.destroy(); // will resolve the promise
              } else {
                await Abq.protocolWrite(socket, Abq.initSuccessMessage());
              }
              return;
            }

            const testCaseMessage: Abq.TestCaseMessage = initOrTestCaseMessage;
            const testCase = testCaseMessage.test_case;

            const fileName = resolveTestPath(testCase.meta.fileName);
            const focus = testCase.focus;

            const test = tests.find(t => t.path === fileName);
            if (!test) {
              throw new Error(`could not find test ${fileName}`);
            }

            // NB: if individual-test running is supported, the configuration
            // must be modified to drill-down on a test.
            const testConfig = this._globalConfig;

            // Estimated start time used in estimating the runtime when the test
            // will ultimately error-out. The estimation is imprecise because the
            // test runner may yield at any async/await points, and not account for
            // that.
            const estimatedStartTime = Date.now();

            await this.#runInBandTest(test, testConfig, {focus, socket}).then(
              result => {
                let testResultMessage: Abq.TestResultMessage;

                // If the test errored before being executed, then we will receive an
                // Error here; however, because jest runs tests in another node
                // process, the error will have been created in another node process
                // as well, and hence will not be seen as an `Error` instance in
                // this process.
                // Instead, rely on the heuristic of error objects to check whether
                // the response is an error.
                //
                // One may expect that ABQ instead patches jest's `runTestInternal`
                // to explicitly throw an error when the underlying test execution
                // process fails; however, to keep ABQ's patch light-weight we
                // currently do not do this.
                function resultIsError(result: any): result is Error {
                  return 'stack' in result && 'message' in result;
                }

                if (!resultIsError(result)) {
                  testResultMessage = {
                    type: 'incremental_result_done',
                  };
                } else {
                  const estimatedRuntime = millisecondToNanosecond(
                    Date.now() - estimatedStartTime,
                  );

                  const formattedError = formatExecError(
                    result,
                    test.context.config,
                    {noStackTrace: false},
                    undefined,
                    true,
                  );

                  const errorResult: Abq.TestResult = {
                    display_name: fileName,
                    id: testCase.id,
                    meta: {},
                    output: formattedError,
                    runtime: estimatedRuntime,
                    status: {
                      backtrace: result.stack
                        ? result.stack.split('\n')
                        : undefined,
                      exception: result.message,
                      type: 'error',
                    },
                  };

                  testResultMessage = {
                    last_test_result: errorResult,
                    type: 'incremental_result_done',
                  };
                }

                return Abq.protocolWrite(socket, testResultMessage);
              },
              error => {
                const errorResult: Abq.TestResult = {
                  display_name: fileName,
                  id: testCase.id,
                  meta: {},
                  output: error.message,
                  runtime: 0,
                  status: {
                    backtrace: error.stack
                      ? error.stack.split('\n')
                      : undefined,
                    exception: error.message,
                    type: 'error',
                  },
                };

                const testResultMessage: Abq.TestResultMessage = {
                  last_test_result: errorResult,
                  type: 'incremental_result_done',
                };
                return Abq.protocolWrite(socket, testResultMessage);
              },
            );
            return undefined;
          });
        })
        .catch(error => reject(error));
    });
  }

  async #createParallelTestRun(tests: Array<Test>, watcher: TestWatcher) {
    const resolvers: Map<string, SerializableResolver> = new Map();
    for (const test of tests) {
      if (!resolvers.has(test.context.config.id)) {
        resolvers.set(test.context.config.id, {
          config: test.context.config,
          serializableModuleMap: test.context.moduleMap.toJSON(),
        });
      }
    }

    const worker = new Worker(require.resolve('./testWorker'), {
      exposedMethods: ['worker'],
      forkOptions: {serialization: 'json', stdio: 'pipe'},
      // The workerIdleMemoryLimit should've been converted to a number during
      // the normalization phase.
      idleMemoryLimit:
        typeof this._globalConfig.workerIdleMemoryLimit === 'number'
          ? this._globalConfig.workerIdleMemoryLimit
          : undefined,
      maxRetries: 3,
      numWorkers: this._globalConfig.maxWorkers,
      setupArgs: [{serializableResolvers: Array.from(resolvers.values())}],
    }) as JestWorkerFarm<TestWorker>;

    if (worker.getStdout()) worker.getStdout().pipe(process.stdout);
    if (worker.getStderr()) worker.getStderr().pipe(process.stderr);

    const mutex = pLimit(this._globalConfig.maxWorkers);

    // Send test suites to workers continuously instead of all at once to track
    // the start time of individual tests.
    const runTestInWorker = (test: Test) =>
      mutex(async () => {
        if (watcher.isInterrupted()) {
          return Promise.reject();
        }

        await this.#eventEmitter.emit('test-file-start', [test]);

        const promise = worker.worker({
          config: test.context.config,
          context: {
            ...this._context,
            changedFiles:
              this._context.changedFiles &&
              Array.from(this._context.changedFiles),
            sourcesRelatedToTestsInChangedFiles:
              this._context.sourcesRelatedToTestsInChangedFiles &&
              Array.from(this._context.sourcesRelatedToTestsInChangedFiles),
          },
          globalConfig: this._globalConfig,
          path: test.path,
        }) as PromiseWithCustomMessage<TestResult>;

        if (promise.UNSTABLE_onCustomMessage) {
          // TODO: Get appropriate type for `onCustomMessage`
          promise.UNSTABLE_onCustomMessage(([event, payload]: any) =>
            this.#eventEmitter.emit(event, payload),
          );
        }

        return promise;
      });

    const onInterrupt = new Promise((_, reject) => {
      watcher.on('change', state => {
        if (state.interrupted) {
          reject(new CancelRun());
        }
      });
    });

    const runAllTests = Promise.all(
      tests.map(test =>
        runTestInWorker(test).then(
          result =>
            this.#eventEmitter.emit('test-file-success', [test, result]),
          error => this.#eventEmitter.emit('test-file-failure', [test, error]),
        ),
      ),
    );

    const cleanup = async () => {
      const {forceExited} = await worker.end();
      if (forceExited) {
        console.error(
          chalk.yellow(
            'A worker process has failed to exit gracefully and has been force exited. ' +
              'This is likely caused by tests leaking due to improper teardown. ' +
              'Try running with --detectOpenHandles to find leaks. ' +
              'Active timers can also cause this, ensure that .unref() was called on them.',
          ),
        );
      }
    };

    return Promise.race([runAllTests, onInterrupt]).then(cleanup, cleanup);
  }

  on<Name extends keyof TestEvents>(
    eventName: Name,
    listener: (eventData: TestEvents[Name]) => void | Promise<void>,
  ): UnsubscribeFn {
    return this.#eventEmitter.on(eventName, listener);
  }
}

function millisecondToNanosecond(ms: number): number {
  return ms * 1000000;
}

class CancelRun extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'CancelRun';
  }
}
