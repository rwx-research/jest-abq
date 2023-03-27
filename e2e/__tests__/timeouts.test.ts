/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import {cleanup, extractSummary, writeFiles} from '../Utils';
import runJest from '../runJest';

const DIR = path.resolve(__dirname, '../timeouts');

beforeEach(() => cleanup(DIR));
afterAll(() => cleanup(DIR));

test('exceeds the timeout', () => {
  writeFiles(DIR, {
    '__tests__/a-banana.js': `
      jest.setTimeout(20);

      test('banana', () => {
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        });
      });
    `,
    'package.json': '{}',
  });

  const {stderr, exitCode} = runJest(DIR, ['-w=1', '--ci=false']);
  const {rest, summary} = extractSummary(stderr);
  expect(rest).toMatch(
    /(jest\.setTimeout|jasmine\.DEFAULT_TIMEOUT_INTERVAL|Exceeded timeout)/,
  );
  expect(summary).toMatchSnapshot();
  expect(exitCode).toBe(1);
});

test('does not exceed the timeout', () => {
  writeFiles(DIR, {
    '__tests__/a-banana.js': `
      jest.setTimeout(1000);

      test('banana', () => {
        return new Promise(resolve => {
          setTimeout(resolve, 20);
        });
      });
    `,
    'package.json': '{}',
  });

  const {stderr, exitCode} = runJest(DIR, ['-w=1', '--ci=false']);
  const {rest, summary} = extractSummary(stderr);
  expect(rest).toMatchSnapshot();
  expect(summary).toMatchSnapshot();
  expect(exitCode).toBe(0);
});

test('exceeds the command line testTimeout', () => {
  writeFiles(DIR, {
    '__tests__/a-banana.js': `

      test('banana', () => {
        return new Promise(resolve => {
          setTimeout(resolve, 1000);
        });
      });
    `,
    'package.json': '{}',
  });

  const {stderr, exitCode} = runJest(DIR, [
    '-w=1',
    '--ci=false',
    '--testTimeout=200',
  ]);
  const {rest, summary} = extractSummary(stderr);
  expect(rest).toMatch(
    /(jest\.setTimeout|jasmine\.DEFAULT_TIMEOUT_INTERVAL|Exceeded timeout)/,
  );
  expect(summary).toMatchSnapshot();
  expect(exitCode).toBe(1);
});

test('does not exceed the command line testTimeout', () => {
  writeFiles(DIR, {
    '__tests__/a-banana.js': `

      test('banana', () => {
        return new Promise(resolve => {
          setTimeout(resolve, 200);
        });
      });
    `,
    'package.json': '{}',
  });

  const {stderr, exitCode} = runJest(DIR, [
    '-w=1',
    '--ci=false',
    '--testTimeout=1000',
  ]);
  const {rest, summary} = extractSummary(stderr);
  expect(rest).toMatchSnapshot();
  expect(summary).toMatchSnapshot();
  expect(exitCode).toBe(0);
});

test('exceeds the timeout specifying that `done` has not been called', () => {
  writeFiles(DIR, {
    '__tests__/a-banana.js': `
      jest.setTimeout(20);

      test('banana', (done) => {
        expect(1 + 1).toBe(2);
      });
    `,
    'package.json': '{}',
  });

  const {stderr, exitCode} = runJest(DIR, ['-w=1', '--ci=false']);
  const {rest, summary} = extractSummary(stderr);
  expect(rest).toMatch(
    /(jest\.setTimeout|Exceeded timeout\.while waiting for `done()` to be called)/,
  );
  expect(summary).toMatchSnapshot();
  expect(exitCode).toBe(1);
});
