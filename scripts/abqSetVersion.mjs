/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Prepare packages prior to building, applying temporary package name
 * overrides, etc.
 */

// eslint-disable-next-line no-restricted-imports
import * as fs from 'fs';
import {createRequire} from 'module';
import * as path from 'path';
import {absoluteProjectPath, ensureVersionsCompatible} from './abqUtils.mjs';

const require = createRequire(import.meta.url);

const newVersion = process.argv[2];
if (!newVersion) {
  throw new Error(`Usage: node ${process.argv[1]} 1.2.3-alpha.5`);
}

ensureVersionsCompatible(newVersion);

const abqJsonPath = path.join(absoluteProjectPath(), 'abq.json');

const abqJson = require(abqJsonPath);
abqJson.version = newVersion;

fs.writeFileSync(abqJsonPath, `${JSON.stringify(abqJson, null, 2)}\n`);

console.log(`Bumped version to ${newVersion}`);
