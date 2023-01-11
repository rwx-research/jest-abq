/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const Net = require('net');

function protocolRead(stream) {
  return new Promise((resolve, reject) => {
    const resolver = function () {
      const buf = stream.read(4);
      console.log('SERVER', buf);
      const messageSize = buf.readUInt32BE(0);
      const msg = stream.read(messageSize);

      stream.removeListener('readable', resolver);

      resolve(msg.toString('utf8'));
    };
    stream.on('readable', resolver);
  });
}

function protocolReader(stream, handler) {
  let buffer = Buffer.from('');
  let messageSize = null;

  function tryProcessBufferMessage(newChunk) {
    if (newChunk !== null) {
      buffer = Buffer.concat([buffer, newChunk], buffer.length + newChunk.length);
    }
    if (messageSize === null && buffer.length >= 4) {
      messageSize = buffer.readUInt32BE(0);
    }
    if (messageSize && buffer.length >= messageSize + 4) {
      // We now know the whole message is available; get it.
      const currentMessage = buffer.toString('utf8', 4, 4 + messageSize);

      // There might be an additional message waiting for us behind the one we
      // just parsed. Reset the buffer to this new message before we handle the
      // current message, so that incoming messages can continue to be
      // processed.
      const newBuffer = buffer.slice(4 + messageSize);
      buffer = newBuffer;
      messageSize = null;

      handler(currentMessage);

      if (buffer.length > 0) {
        // There is more in the buffer waiting behind the message we just
        // parsed; in fact, it may be a whole message waiting to be processed.
        tryProcessBufferMessage(null);
      }
    } else {
      console.log('SERVER:', 'Incomplete chunk, waiting for next chunk');
    }
  }

  stream.on('data', chunk => {
    console.log('SERVER:', `Received chunk: ${chunk.toString()}`);
    tryProcessBufferMessage(chunk);
  });
}

async function protocolWrite(stream, data) {
  const buffer = Buffer.from(JSON.stringify(data), 'utf8');
  const protocolBuffer = Buffer.alloc(4 + buffer.length);
  protocolBuffer.writeUInt32BE(buffer.length, 0);
  buffer.copy(protocolBuffer, 4);
  return new Promise((resolve, reject) => {
    stream.write(protocolBuffer, err => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}

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
    const msg = await protocolRead(socket);
    const data = JSON.parse(msg);
    console.assert(data.type === 'abq_native_runner_spawned');
  }

  async function sendAndRecvInit() {
    await protocolWrite(socket, {init_meta: {}});
    const _initSuccess = JSON.parse(await protocolRead(socket));
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

  protocolReader(socket, message => {
    const data = JSON.parse(message);

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
