/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import {cleanup} from '../Utils';
import runJest from '../runJest';

const dir = path.resolve(__dirname, '../coverage-without-transform');
const coverageDir = path.join(dir, 'coverage');

beforeAll(() => {
  cleanup(coverageDir);
});

afterAll(() => {
  cleanup(coverageDir);
});

it('produces code coverage for uncovered files without transformer', () => {
  const {exitCode, stdout} = runJest(dir, ['--coverage', '--no-cache']);

  expect(exitCode).toBe(0);
  expect(stdout).toMatchSnapshot();
});
