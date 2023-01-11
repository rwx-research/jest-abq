/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const Net = require('net');
const {
  protocolRead,
  protocolWrite,
  protocolReader,
} = require('@rwx-research/abq');

const manifest = process.argv.slice(2).map(arg => JSON.parse(arg));
const server = new Net.Server();
server.listen();
server.on('listening', () => {
  console.log(
    'SERVER:',
    `Server listening for connection requests on socket localhost:${
      server.address().port
    }.`,
  );
  process.send({socketString: `localhost:${server.address().port}`});
});

server.on('connection', async socket => {
  console.log('SERVER:', 'A new connection has been established.');

  // We'll always receive the spawn message first.
  {
    const data = await protocolRead(socket);
    console.assert(data.type === 'abq_native_runner_spawned');
  }

  async function sendAndRecvInit() {
    await protocolWrite(socket, {init_meta: {}});
    const _initSuccess = await protocolRead(socket);
  }

  function sendNextTest() {
    const nextTest = manifest.pop();
    if (nextTest) {
      console.log(`Sending ${nextTest.id} to the native process`);
      return {
        test_case: {
          id: nextTest.id,
          meta: nextTest.meta,
        },
      };
    }
    return undefined;
  }

  if (manifest.length) {
    // Then, write the initialization metadata; we should receive a success.
    await sendAndRecvInit();

    await protocolWrite(socket, sendNextTest());
  }

  let currentResultSet = [];

  protocolReader(socket, data => {
    if (data.manifest) {
      process.send(data);
    } else if (data.type === 'incremental_result') {
      currentResultSet.push(data.one_test_result);
    } else if (data.type === 'incremental_result_done') {
      if (data.last_test_result) {
        currentResultSet.push(data.last_test_result);
      }

      process.send(currentResultSet);
      currentResultSet = [];

      console.log('SERVER:', 'flushing results');
      const nextTest = sendNextTest();

      if (nextTest) {
        console.log(`next test: ${JSON.stringify(nextTest)}`);
        protocolWrite(socket, nextTest);
      } else {
        console.log('SERVER:', 'All tests finished!');
        socket.destroy();
      }
    }
  });

  socket.on('close', () => {
    console.log('SERVER:', 'Closing connection with the client');
    process.send('--CONNECTION CLOSED--');
  });

  socket.on('error', err => {
    console.log('SERVER:', `Error: ${err}`);
    process.send('--ERROR--');
  });
});
