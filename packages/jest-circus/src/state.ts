/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Circus} from '@jest/types';
import eventHandler from './eventHandler';
import formatNodeAssertErrors from './formatNodeAssertErrors';
import {STATE_SYM} from './types';
import {makeDescribe} from './utils';

const eventHandlers: Array<Circus.EventHandler> = [
  eventHandler,
  formatNodeAssertErrors,
];

export const ROOT_DESCRIBE_BLOCK_NAME = 'ROOT_DESCRIBE_BLOCK';
export const ROOT_DESCRIBE_BLOCK_INDEX = 0;

const createState = (): Circus.State => {
  const ROOT_DESCRIBE_BLOCK = makeDescribe(
    ROOT_DESCRIBE_BLOCK_NAME,
    ROOT_DESCRIBE_BLOCK_INDEX,
  );
  return {
    abqFocusTestIds: null,
    abqSocket: null,
    config: null,
    currentDescribeBlock: ROOT_DESCRIBE_BLOCK,
    currentlyRunningTest: null,
    expand: undefined,
    globalConfig: null,
    hasFocusedTests: false,
    hasStarted: false,
    includeTestLocationInResult: false,
    maxConcurrency: 5,
    parentProcess: null,
    rootDescribeBlock: ROOT_DESCRIBE_BLOCK,
    testNamePattern: null,
    testPath: null,
    testTimeout: 5000,
    unhandledErrors: [],
  };
};

/* eslint-disable no-restricted-globals */
export const resetState = (): void => {
  global[STATE_SYM] = createState();
};

resetState();

export const getState = (): Circus.State => global[STATE_SYM];
export const setState = (state: Circus.State): Circus.State =>
  (global[STATE_SYM] = state);
/* eslint-enable */

export const dispatch = async (event: Circus.AsyncEvent): Promise<void> => {
  for (const handler of eventHandlers) {
    await handler(event, getState());
  }
};

export const dispatchSync = (event: Circus.SyncEvent): void => {
  for (const handler of eventHandlers) {
    handler(event, getState());
  }
};

export const addEventHandler = (handler: Circus.EventHandler): void => {
  eventHandlers.push(handler);
};
