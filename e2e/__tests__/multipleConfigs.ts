/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import slash = require('slash');
import runJest from '../runJest';

const MULTIPLE_CONFIGS_WARNING_TEXT = 'Multiple configurations found';

test('multiple configs will throw error', () => {
  const rootDir = slash(path.resolve(__dirname, '../..'));
  const {exitCode, stderr} = runJest('multiple-configs', [], {
    skipPkgJsonCheck: true,
  });

  expect(exitCode).toBe(1);
  expect(stderr).toContain(MULTIPLE_CONFIGS_WARNING_TEXT);

  const cleanStdErr = stderr.replace(new RegExp(rootDir, 'g'), '<rootDir>');
  expect(cleanStdErr).toMatchSnapshot();
});

test('multiple configs error can be suppressed by using --config', () => {
  const {exitCode} = runJest(
    'multiple-configs',
    ['--config', 'jest.config.json'],
    {
      skipPkgJsonCheck: true,
    },
  );
  expect(exitCode).toBe(0);
});
