/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createRequire} from 'module';
import {URL, fileURLToPath} from 'url';
const require = createRequire(import.meta.url);

export const {packages, version} = require('../abq.json');
export const upstreamVersion = require('../lerna.json').version;

export function ensureVersionsCompatible(newVersion) {
  if (typeof newVersion === 'undefined') {
    newVersion = version;
  }

  const parsedRwxVersion = parseVersion(newVersion);
  const parsedUpstreamVersion = parseVersion(upstreamVersion);

  if (
    parsedRwxVersion.major !== parsedUpstreamVersion.major ||
    parsedRwxVersion.minor !== parsedUpstreamVersion.minor
  ) {
    throw new Error(
      `Major and minor version parts must match. RWX: ${newVersion}; upstream: ${upstreamVersion}`,
    );
  }

  if (parsedUpstreamVersion.patch > 99) {
    throw new Error(
      `Unexpected high patch version for upstream: ${upstreamVersion}`,
    );
  }

  const rwxPatchMin = parsedUpstreamVersion.patch * 100;
  const rwxPatchMax = rwxPatchMin + 99;
  if (
    parsedRwxVersion.patch < rwxPatchMin ||
    parsedRwxVersion.patch > rwxPatchMax
  ) {
    throw new Error(
      `Expected RWX patch version between ${rwxPatchMin} and ${rwxPatchMax}, not ${parsedRwxVersion.patch}. RWX: ${newVersion}`,
    );
  }
}

function parseVersion(version) {
  const matcher = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/;
  const result = matcher.exec(version);
  if (!result) {
    throw new Error(`Unable to parse version '${version}'`);
  }

  return result.groups;
}

export function absoluteProjectPath() {
  return fileURLToPath(new URL('..', import.meta.url));
}

export function absolutePackagePath(packageName) {
  return fileURLToPath(new URL(`../packages/${packageName}`, import.meta.url));
}
