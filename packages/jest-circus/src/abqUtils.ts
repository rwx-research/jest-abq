/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import type {Circus} from '@jest/types';

export type AbqTestId = string & {__brand: 'abq_test_id'};

/** Get the unique path of a test in a file but its path of indices from parent
 * describe blocks.
 * Returns the indices ordered from the direct parent of the test to the
 * top-level of the file.
 */
function buildIndexedChain(
  testEntry?: Circus.TestEntry | Circus.DescribeBlock,
): number[] {
  const path = [];
  while (testEntry) {
    path.push(testEntry.indexInParent);
    testEntry = testEntry.parent;
  }
  return path;
}

/** Get a unique ID of a test, for ABQ usage. */
export function idOfTest(
  state: Circus.State,
  testEntry: Circus.TestEntry,
): AbqTestId {
  // `config` and `testPath` is always explicitly populated in ABQ mode.
  const rootDir = state.config!.rootDir;
  const testPath = state.testPath!;
  const relFilePath = path.relative(rootDir, testPath);

  const indexChain = buildIndexedChain(testEntry);
  const indexChainS = indexChain.join(':');

  return `${relFilePath}#${indexChainS}` as AbqTestId;
}
