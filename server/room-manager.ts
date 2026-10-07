import { kv } from '@vercel/kv';
import { generateSessionToken, generateUniqueRoomCode } from './code-generator';
import { RateLimiter } from './rate-limiter';
import type { Role } from '../types/protocol';

export interface Room {
  code: string;
  pcToken: string;
  phoneToken: string | null;
  createdAt: number;
  lastActiveAt: number;
  seenMessageIds: string[];
}

export const INACTIVITY_TIMEOUT_SECONDS = 30 * 60; // 30 minutes
export const MAX_MESSAGE_SIZE_BYTES = 256 * 1024; // 256 KB

const USE_KV = !!process.env.KV_REST_API_URL;

class StateStore {
  private memRooms = new Map<string, Room>();
  private memTokens = new Map<string, string>();
  private memPcQ = new Map<string, any[]>();
  private memPhoneQ = new Map<string, any[]>();

  async getRoom(code: string): Promise<Room | null> {
    if (USE_KV) return await kv.get<Room>(`qd:room:${code}`);
    return this.memRooms.get(code) || null;
  }
  async setRoom(code: string, room: Room) {
    if (USE_KV) await kv.set(`qd:room:${code}`, room, { ex: INACTIVITY_TIMEOUT_SECONDS });
    else this.memRooms.set(code, room);
  }
  async delRoom(code: string) {
    if (USE_KV) await kv.del(`qd:room:${code}`);
    else this.memRooms.delete(code);
  }

  async getCodeByToken(token: string): Promise<string | null> {
    if (USE_KV) return await kv.get<string>(`qd:token:${token}`);
    return this.memTokens.get(token) || null;
  }
  async setToken(token: string, code: string) {
    if (USE_KV) await kv.set(`qd:token:${token}`, code, { ex: INACTIVITY_TIMEOUT_SECONDS });
    else this.memTokens.set(token, code);
  }
  async delToken(token: string) {
    if (USE_KV) await kv.del(`qd:token:${token}`);
    else this.memTokens.delete(token);
  }

  async pushPcMessage(code: string, msg: any) {
    if (USE_KV) {
      await kv.rpush(`qd:pcq:${code}`, msg);
      await kv.expire(`qd:pcq:${code}`, INACTIVITY_TIMEOUT_SECONDS);
    } else {
      if (!this.memPcQ.has(code)) this.memPcQ.set(code, []);
      this.memPcQ.get(code)!.push(msg);
    }
  }
  async popPcMessages(code: string): Promise<any[]> {
    if (USE_KV) {
      const msgs = await kv.lrange(`qd:pcq:${code}`, 0, -1) || [];
      await kv.del(`qd:pcq:${code}`);
      return msgs;
    } else {
      const msgs = this.memPcQ.get(code) || [];
      this.memPcQ.set(code, []);
      return msgs;
    }
  }

  async pushPhoneMessage(code: string, msg: any) {
    if (USE_KV) {
      await kv.rpush(`qd:phoneq:${code}`, msg);
      await kv.expire(`qd:phoneq:${code}`, INACTIVITY_TIMEOUT_SECONDS);
    } else {
      if (!this.memPhoneQ.has(code)) this.memPhoneQ.set(code, []);
      this.memPhoneQ.get(code)!.push(msg);
    }
  }
  async popPhoneMessages(code: string): Promise<any[]> {
    if (USE_KV) {
      const msgs = await kv.lrange(`qd:phoneq:${code}`, 0, -1) || [];
      await kv.del(`qd:phoneq:${code}`);
      return msgs;
    } else {
      const msgs = this.memPhoneQ.get(code) || [];
      this.memPhoneQ.set(code, []);
      return msgs;
    }
  }

  async touch(code: string, pcToken: string, phoneToken: string | null) {
    if (USE_KV) {
      await kv.expire(`qd:room:${code}`, INACTIVITY_TIMEOUT_SECONDS);
      await kv.expire(`qd:token:${pcToken}`, INACTIVITY_TIMEOUT_SECONDS);
      if (phoneToken) await kv.expire(`qd:token:${phoneToken}`, INACTIVITY_TIMEOUT_SECONDS);
    } else {
      const room = this.memRooms.get(code);
      if (room) room.lastActiveAt = Date.now();
    }
  }
}

export class RoomManager {
  private store = new StateStore();
  public rateLimiter: RateLimiter = new RateLimiter();
  public localSockets = new Map<string, any>(); // token -> WebSocket

  public async createRoom(ip: string, creatorRole: Role = 'send'): Promise<{ code: string; token: string; role: Role; pcToken: string }> {
    if (!this.rateLimiter.canCreateRoom(ip)) {
      throw new Error('Rate limit reached. Please wait before creating more rooms.');
    }

    let code = '';
    for (let i = 0; i < 10; i++) {
      const c = generateUniqueRoomCode(() => false, 0);
      const existing = await this.store.getRoom(c);
      if (!existing) { code = c; break; }
    }
    if (!code) throw new Error('Failed to generate unique room code');

    const token = generateSessionToken();
    const now = Date.now();
    const isSender = creatorRole === 'send' || (creatorRole as string) === 'phone';

    const room: Room = {
      code,
      pcToken: isSender ? '' : token,
      phoneToken: isSender ? token : null,
      createdAt: now,
      lastActiveAt: now,
      seenMessageIds: [],
    };

    await this.store.setRoom(code, room);
    await this.store.setToken(token, code);

    return { code, token, role: isSender ? 'send' : 'receive', pcToken: token };
  }

  public async joinRoom(
    code: string,
    role: Role,
    token: string | undefined,
    ip: string,
    ws?: any
  ): Promise<{ role: Role; token: string; code: string; peerConnected: boolean }> {
    const normalizedCode = code?.trim().toUpperCase();
    const room = await this.store.getRoom(normalizedCode);

    const isReceiver = role === 'receive' || (role as string) === 'pc';
    const isSender = role === 'send' || (role as string) === 'phone';

    if (!room) {
      if (isSender) this.rateLimiter.recordFailedJoin(ip);
      throw new Error('Room not found');
    }
    if (!isReceiver && !isSender) throw new Error('Invalid role');

    if (isReceiver) {
      if (!room.pcToken) {
        const canJoin = this.rateLimiter.canAttemptJoin(ip);
        if (!canJoin.allowed) throw new Error('Too many failed attempts. Please wait a moment.');
        
        const receiverToken = generateSessionToken();
        room.pcToken = receiverToken;
        await this.store.setToken(receiverToken, normalizedCode);
        await this.store.setRoom(normalizedCode, room);
        this.rateLimiter.resetFailedJoin(ip);
        
        if (ws) this.localSockets.set(receiverToken, ws);
        return { role, token: receiverToken, code: room.code, peerConnected: !!room.phoneToken };
      }

      if (token && token === room.pcToken) {
        await this.store.touch(normalizedCode, room.pcToken, room.phoneToken);
        if (ws) this.localSockets.set(token, ws);
        return { role, token: room.pcToken, code: room.code, peerConnected: !!room.phoneToken };
      }
      throw new Error('Unauthorized room access');
    } else {
      const canJoin = this.rateLimiter.canAttemptJoin(ip);
      if (!canJoin.allowed) throw new Error('Too many failed attempts. Please wait a moment.');

      if (token && room.phoneToken === token) {
        await this.store.touch(normalizedCode, room.pcToken, room.phoneToken);
        this.rateLimiter.resetFailedJoin(ip);
        if (ws) this.localSockets.set(token, ws);
        return { role, token: room.phoneToken, code: room.code, peerConnected: !!room.pcToken };
      }

      if (room.phoneToken) {
        this.rateLimiter.recordFailedJoin(ip);
        throw new Error('Room already in use');
      }

      const phoneToken = generateSessionToken();
      room.phoneToken = phoneToken;
      await this.store.setToken(phoneToken, normalizedCode);
      await this.store.setRoom(normalizedCode, room);
      this.rateLimiter.resetFailedJoin(ip);

      if (ws) this.localSockets.set(phoneToken, ws);
      return { role, token: phoneToken, code: room.code, peerConnected: !!room.pcToken };
    }
  }

  public async relayMessage(
    token: string,
    messageId: string,
    text: string
  ): Promise<{ ackId: string; targetWs?: any }> {
    if (!token) throw new Error('Unauthorized');
    const code = await this.store.getCodeByToken(token);
    if (!code) throw new Error('Session expired or invalid');
    const room = await this.store.getRoom(code);
    if (!room) throw new Error('Room not found');

    if (token !== room.phoneToken && token !== room.pcToken) throw new Error('Invalid session token');
    if (!this.rateLimiter.canSendMessage(token)) throw new Error('Rate limit reached.');

    const sizeBytes = Buffer.byteLength(text, 'utf8');
    if (sizeBytes > MAX_MESSAGE_SIZE_BYTES) throw new Error('That message is too large.');

    if (room.seenMessageIds.includes(messageId)) {
      return { ackId: messageId };
    }

    room.seenMessageIds.push(messageId);
    if (room.seenMessageIds.length > 100) room.seenMessageIds.shift();
    await this.store.setRoom(code, room);

    const isSender = token === room.phoneToken;
    const targetToken = isSender ? room.pcToken : room.phoneToken;
    
    if (targetToken && this.localSockets.has(targetToken)) {
      const targetWs = this.localSockets.get(targetToken);
      if (targetWs.readyState === 1) { // OPEN
        return { ackId: messageId, targetWs };
      } else {
        this.localSockets.delete(targetToken);
      }
    }

    const msgObj = { t: 'msg', id: messageId, d: text, ts: Date.now() };
    if (isSender) {
      await this.store.pushPcMessage(code, msgObj);
    } else {
      await this.store.pushPhoneMessage(code, msgObj);
    }

    return { ackId: messageId };
  }

  public async pollMessages(token: string, role: Role): Promise<{ peerConnected: boolean; messages: any[] } | null> {
    const code = await this.store.getCodeByToken(token);
    if (!code) return null;
    const room = await this.store.getRoom(code);
    if (!room) return null;

    await this.store.touch(code, room.pcToken, room.phoneToken);

    const isReceiver = role === 'receive' || (role as string) === 'pc';
    const peerConnected = isReceiver ? !!room.phoneToken : !!room.pcToken;
    
    let messages: any[] = [];
    if (isReceiver) {
      messages = await this.store.popPcMessages(code);
    } else {
      messages = await this.store.popPhoneMessages(code);
    }

    return { peerConnected, messages };
  }

  public async leaveRoom(token: string): Promise<void> {
    const code = await this.store.getCodeByToken(token);
    if (code) {
      const room = await this.store.getRoom(code);
      if (room) {
        await this.store.delToken(room.pcToken);
        if (room.phoneToken) await this.store.delToken(room.phoneToken);
        
        // Notify local socket if active
        if (room.pcToken && this.localSockets.has(room.pcToken)) {
          const ws = this.localSockets.get(room.pcToken);
          try { ws.send(JSON.stringify({ t: 'expired' })); ws.close(); } catch {}
        }
        if (room.phoneToken && this.localSockets.has(room.phoneToken)) {
          const ws = this.localSockets.get(room.phoneToken);
          try { ws.send(JSON.stringify({ t: 'expired' })); ws.close(); } catch {}
        }
      }
      await this.store.delRoom(code);
      this.localSockets.delete(token);
    }
  }

  public async handleDisconnect(ws: any): Promise<{ peerWs?: any }> {
    for (const [token, socket] of this.localSockets.entries()) {
      if (socket === ws) {
        this.localSockets.delete(token);
        
        // Try to look up the room to notify peer
        const code = await this.store.getCodeByToken(token);
        if (code) {
          const room = await this.store.getRoom(code);
          if (room) {
            const peerToken = token === room.pcToken ? room.phoneToken : room.pcToken;
            if (peerToken && this.localSockets.has(peerToken)) {
               return { peerWs: this.localSockets.get(peerToken) };
            }
          }
        }
        return {};
      }
    }
    return {};
  }
  
  public async peerJoined(token: string) {
    const code = await this.store.getCodeByToken(token);
    if (!code) return;
    const room = await this.store.getRoom(code);
    if (!room) return;
    const peerToken = token === room.pcToken ? room.phoneToken : room.pcToken;
    if (peerToken && this.localSockets.has(peerToken)) {
      const ws = this.localSockets.get(peerToken);
      if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'peer_joined' }));
    }
  }
}

export const roomManager = new RoomManager();
