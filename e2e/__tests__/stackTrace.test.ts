/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {extractSummary} from '../Utils';
import runJest from '../runJest';

describe('Stack Trace', () => {
  it('prints a stack trace for runtime errors', () => {
    const {exitCode, stderr} = runJest('stack-trace', ['runtimeError.test.js']);

    expect(extractSummary(stderr).summary).toMatchSnapshot();

    expect(exitCode).toBe(1);
    expect(stderr).toMatch(
      /ReferenceError: thisIsARuntimeError is not defined/,
    );
    expect(stderr).toMatch(/> 10 \| thisIsARuntimeError\(\);/);
    expect(stderr).toMatch(
      /\s+at\s(?:.+?)\s\(__tests__\/runtimeError.test\.js/,
    );
  });

  it('does not print a stack trace for runtime errors when --noStackTrace is given', () => {
    const {exitCode, stderr} = runJest('stack-trace', [
      'runtimeError.test.js',
      '--noStackTrace',
    ]);

    expect(extractSummary(stderr).summary).toMatchSnapshot();
    expect(exitCode).toBe(1);

    expect(stderr).toMatch(
      /ReferenceError: thisIsARuntimeError is not defined/,
    );
    expect(stderr).not.toMatch(
      /\s+at\s(?:.+?)\s\(__tests__\/runtimeError.test\.js/,
    );
  });

  it('prints a stack trace for matching errors', () => {
    const {exitCode, stderr} = runJest('stack-trace', ['stackTrace.test.js']);

    expect(extractSummary(stderr).summary).toMatchSnapshot();
    expect(exitCode).toBe(1);

    expect(stderr).toMatch(/\s+at\s(?:.+?)\s\(__tests__\/stackTrace.test\.js/);
  });

  it('does not print a stack trace for matching errors when --noStackTrace is given', () => {
    const {exitCode, stderr} = runJest('stack-trace', [
      'stackTrace.test.js',
      '--noStackTrace',
    ]);

    expect(extractSummary(stderr).summary).toMatchSnapshot();
    expect(exitCode).toBe(1);

    expect(stderr).not.toMatch(
      /\s+at\s(?:.+?)\s\(__tests__\/stackTrace.test\.js/,
    );
  });

  it('prints a stack trace for errors', () => {
    const {exitCode, stderr} = runJest('stack-trace', ['testError.test.js']);

    expect(extractSummary(stderr).summary).toMatchSnapshot();
    expect(exitCode).toBe(1);

    expect(stderr).toMatch(/this is unexpected\./);
    expect(stderr).toMatch(/this is a string\./);

    expect(stderr).toMatch(/\s+at\s(?:.+?)\s\(__tests__\/testError.test\.js/);

    // Make sure we show Jest's jest-resolve as part of the stack trace
    expect(stderr).toMatch(
      /Cannot find module 'this-module-does-not-exist' from '__tests__\/testError\.test\.js'/,
    );

    expect(stderr).toMatch(
      /\s+at\s(?:.+?)\s\((?:.+?)jest-resolve\/build\/resolver\.js/,
    );
  });

  it('prints a stack trace for errors without message in stack trace', () => {
    const {exitCode, stderr} = runJest('stack-trace', [
      'stackTraceWithoutMessage.test.js',
    ]);

    expect(extractSummary(stderr).summary).toMatchSnapshot();
    expect(exitCode).toBe(1);

    expect(stderr).toMatch(/important message/);
    expect(stderr).toMatch(
      /\s+at\s(?:.+?)\s\(__tests__\/stackTraceWithoutMessage.test\.js/,
    );
  });

  it('does not print a stack trace for errors when --noStackTrace is given', () => {
    const {exitCode, stderr} = runJest('stack-trace', [
      'testError.test.js',
      '--noStackTrace',
    ]);

    expect(extractSummary(stderr).summary).toMatchSnapshot();
    expect(exitCode).toBe(1);

    expect(stderr).not.toMatch(
      /\s+at\s(?:.+?)\s\(__tests__\/testError.test\.js/,
    );
  });
});
