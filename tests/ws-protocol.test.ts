import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { setupWebSocketServer } from '../server/ws-handler';
import type { ClientMessage, ServerMessage } from '../types/protocol';

interface TestClient {
  ws: WebSocket;
  nextMessage: () => Promise<ServerMessage>;
  close: () => void;
}

describe('WebSocket End-to-End Protocol', () => {
  let server: ReturnType<typeof createServer>;
  let wss: WebSocketServer;
  let port: number;

  beforeAll(async () => {
    server = createServer();
    wss = new WebSocketServer({ server });
    setupWebSocketServer(wss);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    wss.clients.forEach((client) => client.terminate());
    wss.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  function createTestClient(): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const queue: ServerMessage[] = [];
      const waiters: Array<(msg: ServerMessage) => void> = [];

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          if (waiters.length > 0) {
            const waiter = waiters.shift()!;
            waiter(msg);
          } else {
            queue.push(msg);
          }
        } catch {
          // ignore
        }
      });

      ws.on('open', () => {
        resolve({
          ws,
          nextMessage: () => {
            return new Promise((res) => {
              if (queue.length > 0) {
                res(queue.shift()!);
              } else {
                waiters.push(res);
              }
            });
          },
          close: () => ws.close(),
        });
      });

      ws.on('error', reject);
    });
  }

  it('should support complete PC create -> Phone join -> text relay -> ACK workflow', async () => {
    const pcClient = await createTestClient();

    // 1. PC creates room
    pcClient.ws.send(JSON.stringify({ t: 'create' } as ClientMessage));
    const createdMsg = (await pcClient.nextMessage()) as Extract<
      ServerMessage,
      { t: 'created' }
    >;
    expect(createdMsg.t).toBe('created');
    expect(createdMsg.code.length).toBeGreaterThanOrEqual(2);
    expect(createdMsg.pcToken).toBeDefined();

    const joinedPcMsg = (await pcClient.nextMessage()) as Extract<
      ServerMessage,
      { t: 'joined' }
    >;
    expect(joinedPcMsg.t).toBe('joined');
    expect(['pc', 'receive']).toContain(joinedPcMsg.role);

    // 2. Phone connects and joins with the code
    const phoneClient = await createTestClient();
    phoneClient.ws.send(
      JSON.stringify({
        t: 'join',
        code: createdMsg.code,
        role: 'phone',
      } as ClientMessage)
    );

    const phoneJoinedMsg = (await phoneClient.nextMessage()) as Extract<
      ServerMessage,
      { t: 'joined' }
    >;
    expect(phoneJoinedMsg.t).toBe('joined');
    expect(['phone', 'send']).toContain(phoneJoinedMsg.role);
    expect(phoneJoinedMsg.token).toBeDefined();

    // PC should receive peer_joined notification
    const pcPeerJoinedMsg = await pcClient.nextMessage();
    expect(pcPeerJoinedMsg.t).toBe('peer_joined');

    // 3. Prevent 3rd phone from joining
    const intruderClient = await createTestClient();
    intruderClient.ws.send(
      JSON.stringify({
        t: 'join',
        code: createdMsg.code,
        role: 'phone',
      } as ClientMessage)
    );
    const intruderErr = (await intruderClient.nextMessage()) as Extract<
      ServerMessage,
      { t: 'err' }
    >;
    expect(intruderErr.t).toBe('err');
    expect(intruderErr.msg).toBe('Room already in use');
    intruderClient.close();

    // 4. Phone sends code snippet
    const testSnippet = `function quickDrop() {\n  return "Fast & minimal";\n}`;
    phoneClient.ws.send(
      JSON.stringify({
        t: 'msg',
        id: 'msg-abc-123',
        d: testSnippet,
        token: phoneJoinedMsg.token,
      } as ClientMessage)
    );

    // Phone gets ACK
    const phoneAck = (await phoneClient.nextMessage()) as Extract<ServerMessage, { t: 'ack' }>;
    expect(phoneAck.t).toBe('ack');
    expect(phoneAck.id).toBe('msg-abc-123');

    // PC receives exact text
    const pcReceivedMsg = (await pcClient.nextMessage()) as Extract<ServerMessage, { t: 'msg' }>;
    expect(pcReceivedMsg.t).toBe('msg');
    expect(pcReceivedMsg.id).toBe('msg-abc-123');
    expect(pcReceivedMsg.d).toBe(testSnippet);

    // 5. Malformed payload test
    phoneClient.ws.send('this is not valid json');
    const malformedErr = (await phoneClient.nextMessage()) as Extract<
      ServerMessage,
      { t: 'err' }
    >;
    expect(malformedErr.t).toBe('err');
    expect(malformedErr.msg).toBe('Malformed JSON payload');

    pcClient.close();
    phoneClient.close();
  });

  it('should support Sender create -> Receiver join with code -> Sender sends multi-file -> Receiver receives', async () => {
    const sender = await createTestClient();

    // 1. Sender creates room
    sender.ws.send(JSON.stringify({ t: 'create', role: 'send' } as ClientMessage));
    const createdMsg = (await sender.nextMessage()) as Extract<
      ServerMessage,
      { t: 'created' }
    >;
    expect(createdMsg.t).toBe('created');
    expect(createdMsg.code).toBeDefined();

    const senderJoined = (await sender.nextMessage()) as Extract<
      ServerMessage,
      { t: 'joined' }
    >;
    expect(senderJoined.t).toBe('joined');
    expect(senderJoined.role).toBe('send');
    expect(senderJoined.token).toBeDefined();

    // 2. Receiver connects and joins with the sender's code
    const receiver = await createTestClient();
    receiver.ws.send(
      JSON.stringify({
        t: 'join',
        code: createdMsg.code,
        role: 'receive',
      } as ClientMessage)
    );

    const receiverJoined = (await receiver.nextMessage()) as Extract<
      ServerMessage,
      { t: 'joined' }
    >;
    expect(receiverJoined.t).toBe('joined');
    expect(receiverJoined.role).toBe('receive');
    expect(receiverJoined.token).toBeDefined();

    // Sender gets peer_joined notification
    const senderPeerJoined = await sender.nextMessage();
    expect(senderPeerJoined.t).toBe('peer_joined');

    // 3. Sender sends multi-file batch payload
    const batchPayload = 'FILES::' + JSON.stringify([
      { url: 'https://blob.vercel-storage.com/file1.png', name: 'file1.png', type: 'image/png', size: 1024 },
      { url: 'https://blob.vercel-storage.com/file2.pdf', name: 'file2.pdf', type: 'application/pdf', size: 2048 },
    ]);

    sender.ws.send(
      JSON.stringify({
        t: 'msg',
        id: 'batch-test-1',
        d: batchPayload,
        token: senderJoined.token,
      } as ClientMessage)
    );

    // Sender gets ACK
    const ackMsg = (await sender.nextMessage()) as Extract<ServerMessage, { t: 'ack' }>;
    expect(ackMsg.t).toBe('ack');
    expect(ackMsg.id).toBe('batch-test-1');

    // Receiver gets exact batch payload
    const receivedMsg = (await receiver.nextMessage()) as Extract<ServerMessage, { t: 'msg' }>;
    expect(receivedMsg.t).toBe('msg');
    expect(receivedMsg.d).toBe(batchPayload);

    sender.close();
    receiver.close();
  });
});
