import * as path from 'path';
import type {
  ManifestMember,
  ManifestSuccessMessage,
  TestResult,
  TestResultMessage,
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
    return str.replace(path.resolve(__dirname, '../'), '<<REPLACED>>');
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

export function filterTestResultForSnapshot(
  testResultMessage: TestResultMessage,
) {
  let results;
  if ('test_result' in testResultMessage && testResultMessage.test_result) {
    results = [testResultMessage.test_result];
  } else if (
    'test_results' in testResultMessage &&
    testResultMessage.test_results
  ) {
    results = testResultMessage.test_results;
  } else {
    throw new Error(
      `Unknown testResultMessage type: needs test_result or test_results, got ${Object.keys(
        testResultMessage,
      ).join(', ')}`,
    );
  }
  return results.map(filterTestResultsForSnapshotHelp);
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
    result.status.backtrace = result.status.backtrace.map(replacePath);
  }
  return result;
}
