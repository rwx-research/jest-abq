/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import type {Circus} from '@jest/types';

export type AbqTestId = string & {__brand: 'abq_test_id'};

// Transform the location of a test into a unique ID for the test, for ABQ
// usage.
export function idOfLocation(
  state: Circus.State,
  testEntry: Circus.TestEntry,
  callsite: {column: number; line: number},
): AbqTestId {
  // `config` and `testPath` is always explicitly populated in ABQ mode.
  const rootDir = state.config!.rootDir;
  const testPath = state.testPath!;
  const relFilePath = path.relative(rootDir, testPath);

  const {column, line} = callsite;
  const {indexInParent} = testEntry;

  return `${relFilePath}@${line}:${column}#${indexInParent}` as AbqTestId;
}
