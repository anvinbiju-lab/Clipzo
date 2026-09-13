import type { WebSocket } from 'ws';
import { generateSessionToken, generateUniqueRoomCode } from './code-generator';
import { RateLimiter } from './rate-limiter';
import type { Role, ServerMessage } from '../types/protocol';

export interface Room {
  code: string;
  pcToken: string;
  phoneToken: string | null;
  pcWs: WebSocket | null;
  phoneWs: WebSocket | null;
  createdAt: number;
  lastActiveAt: number;
  seenMessageIds: Set<string>;
  httpMessageQueue?: Array<{ t: 'msg', id: string, d: string, ts: number }>;
}

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const MAX_ROOM_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours
export const MAX_MESSAGE_SIZE_BYTES = 256 * 1024; // 256 KB

export class RoomManager {
  private rooms: Map<string, Room> = new Map(); // code -> Room
  private tokenToCode: Map<string, string> = new Map(); // token -> code
  public rateLimiter: RateLimiter = new RateLimiter();
  private sweepTimer: NodeJS.Timeout;

  constructor() {
    // Sweep expired rooms every 30 seconds
    this.sweepTimer = setInterval(() => this.sweepExpiredRooms(), 30 * 1000);
    this.sweepTimer.unref();
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Create a new temporary room for PC
   */
  public createRoom(ip: string): { code: string; pcToken: string } {
    if (!this.rateLimiter.canCreateRoom(ip)) {
      throw new Error('Rate limit reached. Please wait before creating more rooms.');
    }

    const code = generateUniqueRoomCode((c) => this.rooms.has(c), this.rooms.size);
    const pcToken = generateSessionToken();
    const now = Date.now();

    const room: Room = {
      code,
      pcToken,
      phoneToken: null,
      pcWs: null,
      phoneWs: null,
      createdAt: now,
      lastActiveAt: now,
      seenMessageIds: new Set(),
    };

    this.rooms.set(code, room);
    this.tokenToCode.set(pcToken, code);

    return { code, pcToken };
  }

  /**
   * Register or reconnect PC or Phone to room
   */
  public joinRoom(
    code: string,
    role: Role,
    token: string | undefined,
    ws: WebSocket,
    ip: string
  ): { role: Role; token: string; code: string; peerConnected: boolean } {
    const room = this.rooms.get(code);

    if (!room) {
      if (role === 'phone') {
        this.rateLimiter.recordFailedJoin(ip);
      }
      throw new Error('Room not found');
    }

    const now = Date.now();
    // Check if room expired
    if (now - room.lastActiveAt > INACTIVITY_TIMEOUT_MS || now - room.createdAt > MAX_ROOM_LIFETIME_MS) {
      this.destroyRoom(code);
      throw new Error('Session expired');
    }

    if (role === 'pc') {
      // Reconnecting PC or new PC socket for existing room
      if (token && token !== room.pcToken) {
        throw new Error('Unauthorized room access');
      }
      room.pcWs = ws;
      room.lastActiveAt = now;
      return {
        role: 'pc',
        token: room.pcToken,
        code: room.code,
        peerConnected: !!(room.phoneWs && room.phoneWs.readyState === 1),
      };
    } else {
      // Phone joining
      // Check brute-force join rate limit
      const canJoin = this.rateLimiter.canAttemptJoin(ip);
      if (!canJoin.allowed) {
        throw new Error('Too many failed attempts. Please wait a moment.');
      }

      // If phone presents existing valid phoneToken, allow re-attaching socket
      if (token && room.phoneToken === token) {
        room.phoneWs = ws;
        room.lastActiveAt = now;
        this.rateLimiter.resetFailedJoin(ip);
        return {
          role: 'phone',
          token: room.phoneToken,
          code: room.code,
          peerConnected: !!(room.pcWs && room.pcWs.readyState === 1),
        };
      }

      // If room already has an active phone connected with a different token
      if (room.phoneWs && room.phoneWs.readyState === 1 && room.phoneToken) {
        this.rateLimiter.recordFailedJoin(ip);
        throw new Error('Room already in use');
      }

      // New phone pairing
      const phoneToken = generateSessionToken();
      room.phoneToken = phoneToken;
      room.phoneWs = ws;
      room.lastActiveAt = now;
      this.tokenToCode.set(phoneToken, code);
      this.rateLimiter.resetFailedJoin(ip);

      return {
        role: 'phone',
        token: phoneToken,
        code: room.code,
        peerConnected: !!(room.pcWs && room.pcWs.readyState === 1),
      };
    }
  }

  /**
   * Send a text message from Phone to PC
   */
  public relayMessage(
    token: string,
    messageId: string,
    text: string
  ): { targetWs: WebSocket | null; ackId: string } {
    if (!token) {
      throw new Error('Unauthorized');
    }

    const code = this.tokenToCode.get(token);
    if (!code) {
      throw new Error('Session expired or invalid');
    }

    const room = this.rooms.get(code);
    if (!room) {
      throw new Error('Room not found');
    }

    if (token !== room.phoneToken && token !== room.pcToken) {
      throw new Error('Invalid session token');
    }

    if (!this.rateLimiter.canSendMessage(token)) {
      throw new Error('Rate limit reached. Please slow down.');
    }

    // Size validation (256 KB)
    const sizeBytes = Buffer.byteLength(text, 'utf8');
    if (sizeBytes > MAX_MESSAGE_SIZE_BYTES) {
      throw new Error('That message is too large. Maximum size is 256 KB.');
    }

    // Duplicate prevention
    if (room.seenMessageIds.has(messageId)) {
      return { targetWs: null, ackId: messageId };
    }

    room.seenMessageIds.add(messageId);
    if (room.seenMessageIds.size > 100) {
      // Keep set bounded
      const firstKey = room.seenMessageIds.values().next().value;
      if (firstKey) room.seenMessageIds.delete(firstKey);
    }

    room.lastActiveAt = Date.now();

    // Target is PC receiver
    const targetWs = token === room.phoneToken ? room.pcWs : room.phoneWs;

    return { targetWs, ackId: messageId };
  }

  /**
   * Handle client socket disconnect
   */
  public handleDisconnect(ws: WebSocket): { peerWs: WebSocket | null } | null {
    for (const room of this.rooms.values()) {
      if (room.pcWs === ws) {
        room.pcWs = null;
        return { peerWs: room.phoneWs };
      }
      if (room.phoneWs === ws) {
        room.phoneWs = null;
        return { peerWs: room.pcWs };
      }
    }
    return null;
  }

  /**
   * User explicitly leaves / closes session
   */
  public leaveRoom(token: string): void {
    const code = this.tokenToCode.get(token);
    if (code) {
      this.destroyRoom(code);
    }
  }

  /**
   * Close sockets and purge room
   */
  public destroyRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    const expiredMsg = JSON.stringify({ t: 'expired' } as ServerMessage);

    if (room.pcWs && room.pcWs.readyState === 1) {
      try {
        room.pcWs.send(expiredMsg);
        room.pcWs.close();
      } catch {
        // ignore
      }
    }

    if (room.phoneWs && room.phoneWs.readyState === 1) {
      try {
        room.phoneWs.send(expiredMsg);
        room.phoneWs.close();
      } catch {
        // ignore
      }
    }

    this.tokenToCode.delete(room.pcToken);
    if (room.phoneToken) {
      this.tokenToCode.delete(room.phoneToken);
    }
    this.rooms.delete(code);
  }

  /**
   * Sweep inactive or expired rooms
   */
  private sweepExpiredRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      const isInactive = now - room.lastActiveAt > INACTIVITY_TIMEOUT_MS;
      const isOverMaxCap = now - room.createdAt > MAX_ROOM_LIFETIME_MS;

      if (isInactive || isOverMaxCap) {
        this.destroyRoom(code);
      }
    }
  }

  public getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }
}

// Global singleton for the process
export const roomManager = new RoomManager();
