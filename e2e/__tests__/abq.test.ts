/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ChildProcess, spawn} from 'child_process';
import * as path from 'path';
import {
  AbqProject,
  filterManifestForSnapshot,
  filterTestResultForSnapshot,
  pathForAbqFlatTestFile,
  runAbqJest,
} from '../abqUtils';

// set this to true to see the server output with your jest results
const DEBUG_SERVER = false;

let serverToCleanup: ChildProcess;

const stdioVal = DEBUG_SERVER ? 'inherit' : 'ignore';

function spawnServer(
  args: Array<any> = [],
): Promise<[string, () => Promise<Array<any>>]> {
  const serverMessages: Array<any> = [];
  let resolveMessages: any;
  const messagesPromise = new Promise<Array<any>>(resolve => {
    resolveMessages = resolve;
  });
  async function getMessages() {
    return messagesPromise;
  }
  return new Promise(resolve => {
    const serverPath = path.resolve(__dirname, '../server.js');
    const server = (serverToCleanup = spawn(
      'node',
      [serverPath, ...args.map(a => JSON.stringify(a))],
      {
        stdio: [stdioVal, stdioVal, stdioVal, 'ipc'],
      },
    ));

    server.on('message', message => {
      if (message.socketString) {
        resolve([message.socketString, getMessages]);
      } else if (message === '--CONNECTION CLOSED--') {
        resolveMessages(serverMessages);
      } else {
        serverMessages.push(message);
      }
    });
  });
}

function ctest(...args: Parameters<typeof test>) {
  if (process.env.JEST_JASMINE === '1') {
    // ABQ does not support jest-jasmine2
    test.skip(...args);
    return;
  }
  test(...args);
}

afterEach(async () => {
  if (serverToCleanup) {
    serverToCleanup.kill();
  }
});

ctest('ABQ_GENERATE_MANIFEST sends the manifest to the socket', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer();

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_GENERATE_MANIFEST: '1',
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterManifestForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest(
  'Generates test IDs for tests in a monorepo relative to the monorepo root',
  async () => {
    expect.assertions(2);

    let rawManifest: any;

    {
      const [socketString, getMessages] = await spawnServer();

      await runAbqJest(
        AbqProject.Monorepo,
        {
          ABQ_GENERATE_MANIFEST: '1',
          ABQ_SOCKET: socketString,
        },
        async () => {
          const rawMessages = await getMessages();
          const prettyMessages = rawMessages.map(filterManifestForSnapshot);
          rawManifest = prettyMessages[0];
          expect(prettyMessages).toMatchSnapshot();
        },
      );

      serverToCleanup.kill();
    }

    {
      const [socketString, getMessages] = await spawnServer(
        rawManifest!['manifest']['members'],
      );

      await runAbqJest(
        AbqProject.Monorepo,
        {
          ABQ_SOCKET: socketString,
        },
        async () => {
          const serverMessages = (await getMessages()).map(
            filterTestResultForSnapshot,
          );
          expect(serverMessages).toMatchSnapshot();
        },
      );
    }
  },
);

ctest('ABQ_SOCKET runs Jest in ABQ mode', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('sum.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('sum.test.js'),
      },
      tags: [],
      type: 'test',
    },
    {
      id: pathForAbqFlatTestFile('failing.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('failing.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest('Reports all tests in a file', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('sum.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('sum.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest(
  'ABQ_HIDE_NATIVE_OUTPUT hides all output in the jest process',
  async () => {
    expect.assertions(2);

    const [socketString, getMessages] = await spawnServer([
      {
        id: pathForAbqFlatTestFile('sum.test.js'),
        meta: {
          fileName: pathForAbqFlatTestFile('sum.test.js'),
        },
        tags: [],
        type: 'test',
      },
      {
        id: pathForAbqFlatTestFile('failing.test.js'),
        meta: {
          fileName: pathForAbqFlatTestFile('failing.test.js'),
        },
        tags: [],
        type: 'test',
      },
    ]);

    const {stderr, stdout} = await runAbqJest(
      AbqProject.Flat,
      {
        ABQ_HIDE_NATIVE_OUTPUT: '1',
        ABQ_SOCKET: socketString,
      },
      getMessages,
    );

    expect(stderr).toBe('');
    expect(stdout).toBe('');
  },
);

ctest('ABQ mode handles errors in a test', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('errors.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('errors.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest('ABQ mode handles errors outside of test execution', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('error_setup.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('error_setup.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest('ABQ mode handles skipped tests', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('skip.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('skip.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest('ABQ mode handles todo tests', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('todo.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('todo.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest('ABQ mode handles ID generation for tests in loops', async () => {
  expect.assertions(4);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('looped.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('looped.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );

      expect(serverMessages).toHaveLength(1);
      const results = serverMessages[0];
      expect(results).toHaveLength(9);

      const ids = new Set();
      for (const result of results) {
        ids.add(result.id);
      }

      expect(ids.size).toBe(9);

      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest('ABQ mode runs focused tests', async () => {
  expect.assertions(4);

  const looped = pathForAbqFlatTestFile('looped.test.js');
  const loopedRelative = path.relative(
    path.resolve(__dirname, '../abq'),
    looped,
  );

  const [socketString, getMessages] = await spawnServer([
    {
      focus: {
        test_ids: [
          `${loopedRelative}#2:1:0`,
          `${loopedRelative}#1:2:0`,
          `${loopedRelative}#0:0:0`,
        ],
      },
      id: looped,
      meta: {
        fileName: looped,
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );

      expect(serverMessages).toHaveLength(1);
      const results = serverMessages[0];
      expect(results).toHaveLength(3);

      const ids = new Set();
      for (const result of results) {
        ids.add(result.id);
      }

      expect(ids.size).toBe(3);

      expect(serverMessages).toMatchSnapshot();
    },
  );
});

ctest('ABQ mode handles inline snapshots', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqFlatTestFile('inline-snapshot.test.js'),
      meta: {
        fileName: pathForAbqFlatTestFile('inline-snapshot.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    AbqProject.Flat,
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );
      expect(serverMessages).toMatchSnapshot();
    },
  );
});
