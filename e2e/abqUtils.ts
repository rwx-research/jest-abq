import * as path from 'path';
import type {AbqTypes} from '../packages/jest-types/src';
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
    return str.replace(path.resolve(__dirname, '../'), '<<REPLACED>>');
  }
  return str;
}

function sortMembers(m1: AbqTypes.ManifestMember, m2: AbqTypes.ManifestMember) {
  const m1Name = m1.type === 'group' ? m1.name : m1.id;
  const m2Name = m2.type === 'group' ? m2.name : m2.id;

  return m1Name.localeCompare(m2Name);
}

function filterMemberForSnapshot(
  member: AbqTypes.ManifestMember,
): AbqTypes.ManifestMember {
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
  manifestMessage: AbqTypes.ManifestMessage,
) {
  return {
    manifest: {
      members: manifestMessage.manifest.members
        .map(filterMemberForSnapshot)
        .sort(sortMembers),
      init_meta: manifestMessage.manifest.init_meta,
    },
  };
}

export function filterTestResultForSnapshot(
  testResultMessage: AbqTypes.TestResultMessage,
) {
  let results;
  if (testResultMessage.test_result) {
    results = [testResultMessage.test_result];
  } else {
    results = testResultMessage.test_results;
  }
  return results.map(filterTestResultsForSnapshotHelp);
}

export function filterTestResultsForSnapshotHelp(
  testResult: AbqTypes.TestResult,
) {
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
  if (result.status.backtrace) {
    result.status.backtrace = result.status.backtrace.map(replacePath);
  }
  return result;
}
