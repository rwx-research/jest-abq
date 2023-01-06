/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import type {
  ManifestMember,
  ManifestSuccessMessage,
  TestResult,
} from '@rwx-research/abq';
import runJest from './runJest';

export function pathForAbqTestFile(file: string) {
  return path.resolve(__dirname, './abq/__tests__/', file);
}

export async function runAbqJest(env: Record<string, string>, cb: any) {
  const {stdout, stderr} = runJest('abq', [], {
    env,
  });

  try {
    await cb();
    return {stderr, stdout};
  } catch (e) {
    console.log(stdout, stderr);
    throw e;
  }
}

function replacePath<T>(str: T) {
  if (typeof str === 'string') {
    return str
      .replace(path.resolve(__dirname, '../'), '<<REPLACED>>')
      .replace(/\\/g, '/');
  }
  return str;
}

function sortMembers(m1: ManifestMember, m2: ManifestMember) {
  const m1Name = m1.type === 'group' ? m1.name : m1.id;
  const m2Name = m2.type === 'group' ? m2.name : m2.id;

  return m1Name.localeCompare(m2Name);
}

function filterMemberForSnapshot(member: ManifestMember): ManifestMember {
  if (member.type === 'test') {
    return {
      ...member,
      id: replacePath(member.id),
      meta: {
        ...member.meta,
        fileName: replacePath(member.meta.fileName),
      },
    };
  }

  return {
    ...member,
    members: member.members.map(filterMemberForSnapshot).sort(sortMembers),
    name: replacePath(member.name),
  };
}

export function filterManifestForSnapshot(
  manifestMessage: ManifestSuccessMessage,
) {
  return {
    manifest: {
      init_meta: manifestMessage.manifest.init_meta,
      members: manifestMessage.manifest.members
        .map(filterMemberForSnapshot)
        .sort(sortMembers),
    },
  };
}

export function filterTestResultForSnapshot(testResults: TestResult[]) {
  return testResults.map(filterTestResultsForSnapshotHelp);
}

export function filterTestResultsForSnapshotHelp(testResult: TestResult) {
  const result = {
    ...testResult,
    display_name: replacePath(testResult.display_name),
    id: replacePath(testResult.id),
    output: replacePath(testResult.output),
    runtime: typeof testResult.runtime === 'number' ? 12 : testResult.runtime,
  };
  if (result.location) {
    result.location.file = replacePath(result.location.file);
  }
  if ('backtrace' in result.status && result.status.backtrace) {
    result.status.backtrace = result.status.backtrace.map(l => {
      return replacePath(l)
        .replace(/.*jest-circus.*/, '<<TEST_RUNNER>>')
        .replace(/.*jest-jasmine2.*/, '<<TEST_RUNNER>>')
        .replace(/.*processTicks.*/, '<<NODE INTERNAL>>');
    });
  }
  return result;
}
