/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {getAbqConfiguration} from '@rwx-research/abq';

if (getAbqConfiguration().shouldHideNativeOutput) {
  const _doNothing: any = () => {
    // do nothing
  };
  process.stdout.write = _doNothing;
  process.stderr.write = _doNothing;
}

export {default as SearchSource} from './SearchSource';
export {createTestScheduler} from './TestScheduler';
export {runCLI} from './cli';
export {default as getVersion} from './version';
