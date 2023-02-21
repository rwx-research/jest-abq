/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ChildProcess, spawn} from 'child_process';
import * as path from 'path';
import {
  filterManifestForSnapshot,
  filterTestResultForSnapshot,
  pathForAbqTestFile,
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

ctest('ABQ_SOCKET runs Jest in ABQ mode', async () => {
  expect.assertions(1);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqTestFile('sum.test.js'),
      meta: {
        fileName: pathForAbqTestFile('sum.test.js'),
      },
      tags: [],
      type: 'test',
    },
    {
      id: pathForAbqTestFile('failing.test.js'),
      meta: {
        fileName: pathForAbqTestFile('failing.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
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
      id: pathForAbqTestFile('sum.test.js'),
      meta: {
        fileName: pathForAbqTestFile('sum.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
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
        id: pathForAbqTestFile('sum.test.js'),
        meta: {
          fileName: pathForAbqTestFile('sum.test.js'),
        },
        tags: [],
        type: 'test',
      },
      {
        id: pathForAbqTestFile('failing.test.js'),
        meta: {
          fileName: pathForAbqTestFile('failing.test.js'),
        },
        tags: [],
        type: 'test',
      },
    ]);

    const {stderr, stdout} = await runAbqJest(
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
      id: pathForAbqTestFile('errors.test.js'),
      meta: {
        fileName: pathForAbqTestFile('errors.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
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
      id: pathForAbqTestFile('error_setup.test.js'),
      meta: {
        fileName: pathForAbqTestFile('error_setup.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
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
      id: pathForAbqTestFile('skip.test.js'),
      meta: {
        fileName: pathForAbqTestFile('skip.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
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
      id: pathForAbqTestFile('todo.test.js'),
      meta: {
        fileName: pathForAbqTestFile('todo.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
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

ctest('ABQ handles ID generation for tests in loops', async () => {
  expect.assertions(4);

  const [socketString, getMessages] = await spawnServer([
    {
      id: pathForAbqTestFile('looped.test.js'),
      meta: {
        fileName: pathForAbqTestFile('looped.test.js'),
      },
      tags: [],
      type: 'test',
    },
  ]);

  await runAbqJest(
    {
      ABQ_SOCKET: socketString,
    },
    async () => {
      const serverMessages = (await getMessages()).map(
        filterTestResultForSnapshot,
      );

      expect(serverMessages.length).toBe(1);
      const results = serverMessages[0];
      expect(results.length).toBe(9);

      let ids = new Set();
      for (const result of results) {
        ids.add(result.id);
      }

      expect(ids.size).toBe(9);

      expect(serverMessages).toMatchSnapshot();
    },
  );
});
