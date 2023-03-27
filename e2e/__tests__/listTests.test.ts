/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import runJest from '../runJest';

const testRootDir = path.resolve(__dirname, '..', '..');

const normalizePaths = (rawPaths: string) =>
  rawPaths
    .split(testRootDir)
    .join(`${path.sep}MOCK_ABSOLUTE_PATH`)
    .split('\\')
    .join('/');

describe('--listTests flag', () => {
  it('causes tests to be printed in different lines', () => {
    const {exitCode, stdout} = runJest('list-tests', ['--listTests']);

    expect(exitCode).toBe(0);
    expect(
      normalizePaths(stdout).split('\n').sort().join('\n'),
    ).toMatchSnapshot();
  });

  it('causes tests to be printed out as JSON when using the --json flag', () => {
    const {exitCode, stdout} = runJest('list-tests', ['--listTests', '--json']);

    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(
      JSON.stringify(JSON.parse(stdout).map(normalizePaths).sort()),
    ).toMatchSnapshot();
  });
});
