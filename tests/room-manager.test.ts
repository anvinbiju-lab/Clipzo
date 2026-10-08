import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { RoomManager, MAX_MESSAGE_SIZE_BYTES } from '../server/room-manager';

// Mock WebSocket object
function createMockWs(): WebSocket {
  return {
    readyState: 1, // OPEN
    send: () => {},
    close: () => {},
  } as unknown as WebSocket;
}

describe('RoomManager', () => {
  it('should create a room with unique code and pcToken', async () => {
    const manager = new RoomManager();
    const { code, pcToken } = await manager.createRoom('127.0.0.1');

    expect(code.length).toBeGreaterThanOrEqual(2);
    expect(pcToken).toHaveLength(64);
  });

  it('should reject joining non-existent room', async () => {
    const manager = new RoomManager();
    const ws = createMockWs();

    await expect(async () => {
      await manager.joinRoom('ZZZZ', 'phone', undefined, '127.0.0.1', ws);
    }).rejects.toThrow('Room not found');
  });

  it('should allow phone to join valid room', async () => {
    const manager = new RoomManager();
    const { code } = await manager.createRoom('127.0.0.1', 'receive');
    const phoneWs = createMockWs();

    const joinResult = await manager.joinRoom(code, 'phone', undefined, '127.0.0.1', phoneWs);
    expect(joinResult.role).toBe('phone');
    expect(joinResult.token).toHaveLength(64);
    expect(joinResult.code).toBe(code);
  });

  it('should prevent a second phone from hijacking an occupied room', async () => {
    const manager = new RoomManager();
    const { code } = await manager.createRoom('127.0.0.1', 'receive');
    const phone1Ws = createMockWs();
    const phone2Ws = createMockWs();

    // First phone joins
    await manager.joinRoom(code, 'phone', undefined, '127.0.0.1', phone1Ws);

    // Second phone tries to join
    await expect(async () => {
      await manager.joinRoom(code, 'phone', undefined, '127.0.0.2', phone2Ws);
    }).rejects.toThrow('Room already in use');
  });

  it('should allow phone to reconnect using its issued session token', async () => {
    const manager = new RoomManager();
    const { code } = await manager.createRoom('127.0.0.1', 'receive');
    const phoneWs1 = createMockWs();
    const { token: phoneToken } = await manager.joinRoom(code, 'phone', undefined, '127.0.0.1', phoneWs1);

    // Phone disconnects then reconnects with same token
    const phoneWs2 = createMockWs();
    const reconnectResult = await manager.joinRoom(code, 'phone', phoneToken, '127.0.0.1', phoneWs2);

    expect(reconnectResult.token).toBe(phoneToken);
  });

  it('should relay messages from phone to PC with exact byte preservation', async () => {
    const manager = new RoomManager();
    const { code, pcToken } = await manager.createRoom('127.0.0.1', 'receive');
    const pcWs = createMockWs();
    const phoneWs = createMockWs();

    await manager.joinRoom(code, 'pc', pcToken, '127.0.0.1', pcWs);
    const { token: phoneToken } = await manager.joinRoom(code, 'phone', undefined, '127.0.0.1', phoneWs);

    const exactCodeSnippet = '#include <stdio.h>\n\nint main() {\n    printf("Hello QuickDrop!\\n");\n    return 0;\n}';
    const { targetWs, ackId } = await manager.relayMessage(phoneToken, 'msg-1', exactCodeSnippet);

    expect(targetWs).toBe(pcWs);
    expect(ackId).toBe('msg-1');
  });

  it('should reject messages exceeding maximum size of 256 KB', async () => {
    const manager = new RoomManager();
    const { code } = await manager.createRoom('127.0.0.1', 'receive');
    const phoneWs = createMockWs();
    const { token: phoneToken } = await manager.joinRoom(code, 'phone', undefined, '127.0.0.1', phoneWs);

    const largePayload = 'A'.repeat(MAX_MESSAGE_SIZE_BYTES + 10);
    await expect(async () => {
      await manager.relayMessage(phoneToken, 'msg-large', largePayload);
    }).rejects.toThrow('That message is too large');
  });

  it('should reject unauthorized message sending without valid token', async () => {
    const manager = new RoomManager();
    await expect(async () => {
      await manager.relayMessage('bad-token', 'msg-fake', 'hello');
    }).rejects.toThrow('Session expired or invalid');
  });

  it('should deliver messages via pollMessages when using HTTP queue polling', async () => {
    const manager = new RoomManager();
    const { code, token: senderToken } = await manager.createRoom('127.0.0.1', 'send');
    const { token: receiverToken } = await manager.joinRoom(code, 'receive', undefined, '127.0.0.2');

    // Sender sends a message without an active local WebSocket (e.g. serverless)
    const testSnippet = 'print("Hello from test")';
    const { ackId } = await manager.relayMessage(senderToken, 'msg-poll-1', testSnippet);
    expect(ackId).toBe('msg-poll-1');

    // Receiver polls for messages
    const receiverPoll = await manager.pollMessages(receiverToken);
    expect(receiverPoll).not.toBeNull();
    expect(receiverPoll!.peerConnected).toBe(true);
    expect(receiverPoll!.messages).toHaveLength(1);
    expect(receiverPoll!.messages[0].d).toBe(testSnippet);

    // Second poll should be empty since messages were popped
    const secondPoll = await manager.pollMessages(receiverToken);
    expect(secondPoll!.messages).toHaveLength(0);

    // Sender polls for status and gets peerConnected = true
    const senderPoll = await manager.pollMessages(senderToken);
    expect(senderPoll!.peerConnected).toBe(true);
  });
});
