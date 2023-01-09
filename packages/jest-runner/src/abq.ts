/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import {loadJson} from 'json.macro';

const abq = <any>loadJson('../../../abq.json');
const lerna = <any>loadJson('../../../lerna.json');

export const abqSpawnedMessage = {
  adapterName: 'jest-abq',
  adapterVersion: abq.version,
  testFramework: 'jest',
  testFrameworkVersion: lerna.version,
};
