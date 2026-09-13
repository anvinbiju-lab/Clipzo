import { NextResponse } from 'next/server';
import { roomManager } from '../../../server/room-manager';
import type { ClientMessage, Role } from '../../../types/protocol';

// HTTP Polling Fallback for Vercel Serverless
// Uses the same in-memory roomManager. On Vercel, this works as long as the lambda stays hot.

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = (await req.json()) as ClientMessage | { t: 'poll'; token: string; role: Role };

    switch (body.t) {
      case 'create': {
        const { code, pcToken } = roomManager.createRoom(ip);
        // Automatically join PC to the room to set active
        const joinResult = roomManager.joinRoom(code, 'pc', pcToken, null as any, ip);
        return NextResponse.json({
          t: 'created',
          code,
          pcToken,
          peerConnected: joinResult.peerConnected,
        });
      }

      case 'join': {
        const result = roomManager.joinRoom(body.code, body.role, body.token, null as any, ip);
        return NextResponse.json({
          t: 'joined',
          role: result.role,
          token: result.token,
          code: result.code,
          peerConnected: result.peerConnected,
        });
      }

      case 'msg': {
        if (!body.d) return NextResponse.json({ t: 'err', msg: 'Empty message' }, { status: 400 });
        const { ackId, targetWs } = roomManager.relayMessage(body.token, body.id, body.d);
        
        // In HTTP mode, targetWs is null. We must queue the message in the room for the peer to poll.
        const code = (roomManager as any).tokenToCode.get(body.token);
        const room = roomManager.getRoom(code);
        if (room) {
          if (!room.httpMessageQueue) room.httpMessageQueue = [];
          room.httpMessageQueue.push({ t: 'msg', id: body.id, d: body.d, ts: Date.now() });
        }

        return NextResponse.json({ t: 'ack', id: ackId });
      }

      case 'poll': {
        const code = (roomManager as any).tokenToCode.get(body.token);
        if (!code) return NextResponse.json({ t: 'expired' });
        
        const room = roomManager.getRoom(code);
        if (!room) return NextResponse.json({ t: 'expired' });

        // Update activity
        room.lastActiveAt = Date.now();

        const peerConnected = body.role === 'pc' ? !!room.phoneToken : true;
        const messages = room.httpMessageQueue || [];
        room.httpMessageQueue = []; // Clear queue after reading

        return NextResponse.json({
          t: 'poll_result',
          peerConnected,
          messages,
        });
      }

      case 'leave': {
        if (body.token) roomManager.leaveRoom(body.token);
        return NextResponse.json({ t: 'ok' });
      }

      default:
        return NextResponse.json({ t: 'err', msg: 'Unknown command' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ t: 'err', msg: err.message }, { status: 400 });
  }
}
