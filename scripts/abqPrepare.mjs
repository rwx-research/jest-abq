/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
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
import chalk from 'chalk';
import {
  absolutePackagePath,
  ensureVersionsCompatible,
  packages,
  version,
} from './abqUtils.mjs';

const require = createRequire(import.meta.url);

ensureVersionsCompatible();

packages.forEach(pkg => {
  try {
    const packageJsonPath = path.join(
      absolutePackagePath(pkg.path),
      'package.json',
    );

    const packageJson = require(packageJsonPath);
    packageJson.name = pkg.rwxName;
    packageJson.version = version;

    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );

    console.log(`Prepared ${pkg.path}`);
  } catch (err) {
    console.log(chalk.inverse.red(`Error preparing ${pkg.path}`));
    throw err;
  }
});
