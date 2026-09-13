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
  it('should create a room with unique code and pcToken', () => {
    const manager = new RoomManager();
    const { code, pcToken } = manager.createRoom('127.0.0.1');

    expect(code).toHaveLength(4);
    expect(pcToken).toHaveLength(64);
    expect(manager.getActiveRoomCount()).toBe(1);
  });

  it('should reject joining non-existent room', () => {
    const manager = new RoomManager();
    const ws = createMockWs();

    expect(() => {
      manager.joinRoom('ZZZZ', 'phone', undefined, ws, '127.0.0.1');
    }).toThrow('Room not found');
  });

  it('should allow phone to join valid room', () => {
    const manager = new RoomManager();
    const { code } = manager.createRoom('127.0.0.1');
    const phoneWs = createMockWs();

    const joinResult = manager.joinRoom(code, 'phone', undefined, phoneWs, '127.0.0.1');
    expect(joinResult.role).toBe('phone');
    expect(joinResult.token).toHaveLength(64);
    expect(joinResult.code).toBe(code);
  });

  it('should prevent a second phone from hijacking an occupied room', () => {
    const manager = new RoomManager();
    const { code } = manager.createRoom('127.0.0.1');
    const phone1Ws = createMockWs();
    const phone2Ws = createMockWs();

    // First phone joins
    manager.joinRoom(code, 'phone', undefined, phone1Ws, '127.0.0.1');

    // Second phone tries to join
    expect(() => {
      manager.joinRoom(code, 'phone', undefined, phone2Ws, '127.0.0.2');
    }).toThrow('Room already in use');
  });

  it('should allow phone to reconnect using its issued session token', () => {
    const manager = new RoomManager();
    const { code } = manager.createRoom('127.0.0.1');
    const phoneWs1 = createMockWs();
    const { token: phoneToken } = manager.joinRoom(code, 'phone', undefined, phoneWs1, '127.0.0.1');

    // Phone disconnects then reconnects with same token
    const phoneWs2 = createMockWs();
    const reconnectResult = manager.joinRoom(code, 'phone', phoneToken, phoneWs2, '127.0.0.1');

    expect(reconnectResult.token).toBe(phoneToken);
  });

  it('should relay messages from phone to PC with exact byte preservation', () => {
    const manager = new RoomManager();
    const { code, pcToken } = manager.createRoom('127.0.0.1');
    const pcWs = createMockWs();
    const phoneWs = createMockWs();

    manager.joinRoom(code, 'pc', pcToken, pcWs, '127.0.0.1');
    const { token: phoneToken } = manager.joinRoom(code, 'phone', undefined, phoneWs, '127.0.0.1');

    const exactCodeSnippet = '#include <stdio.h>\n\nint main() {\n    printf("Hello QuickDrop!\\n");\n    return 0;\n}';
    const { targetWs, ackId } = manager.relayMessage(phoneToken, 'msg-1', exactCodeSnippet);

    expect(targetWs).toBe(pcWs);
    expect(ackId).toBe('msg-1');
  });

  it('should reject messages exceeding maximum size of 256 KB', () => {
    const manager = new RoomManager();
    const { code } = manager.createRoom('127.0.0.1');
    const phoneWs = createMockWs();
    const { token: phoneToken } = manager.joinRoom(code, 'phone', undefined, phoneWs, '127.0.0.1');

    const largePayload = 'A'.repeat(MAX_MESSAGE_SIZE_BYTES + 10);
    expect(() => {
      manager.relayMessage(phoneToken, 'msg-large', largePayload);
    }).toThrow('That message is too large. Maximum size is 256 KB.');
  });

  it('should reject unauthorized message sending without valid token', () => {
    const manager = new RoomManager();
    expect(() => {
      manager.relayMessage('bad-token', 'msg-fake', 'hello');
    }).toThrow('Session expired or invalid');
  });

  it('should destroy room and delete session data when leaveRoom is called', () => {
    const manager = new RoomManager();
    const { code, pcToken } = manager.createRoom('127.0.0.1');
    expect(manager.getRoom(code)).toBeDefined();

    manager.leaveRoom(pcToken);
    expect(manager.getRoom(code)).toBeUndefined();
    expect(manager.getActiveRoomCount()).toBe(0);
  });
});
