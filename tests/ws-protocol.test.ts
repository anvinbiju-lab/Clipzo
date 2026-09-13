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
    expect(createdMsg.code).toHaveLength(4);
    expect(createdMsg.pcToken).toBeDefined();

    const joinedPcMsg = (await pcClient.nextMessage()) as Extract<
      ServerMessage,
      { t: 'joined' }
    >;
    expect(joinedPcMsg.t).toBe('joined');
    expect(joinedPcMsg.role).toBe('pc');

    // 2. Phone connects and joins with the 4-char code
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
    expect(phoneJoinedMsg.role).toBe('phone');
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
});
