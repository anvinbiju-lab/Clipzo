import { NextResponse } from 'next/server';
import { roomManager } from '../../../server/room-manager';
import type { ClientMessage, Role } from '../../../types/protocol';

// HTTP Polling Fallback for Vercel Serverless
// Uses the async KV-backed roomManager to persist across lambda cold starts.

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = (await req.json()) as ClientMessage | { t: 'poll'; token: string; role: Role };

    switch (body.t) {
      case 'create': {
        const role: Role = (body as any).role || 'send';
        const { code, token, pcToken } = await roomManager.createRoom(ip, role);
        const joinResult = await roomManager.joinRoom(code, role, token, ip);
        return NextResponse.json({
          t: 'created',
          code,
          token,
          role,
          pcToken,
          peerConnected: joinResult.peerConnected,
        });
      }

      case 'join': {
        const result = await roomManager.joinRoom(body.code, body.role, body.token, ip);
        // If peer is connected, we must notify them through WebSocket if they are actively connected
        await roomManager.peerJoined(result.token);
        
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
        
        const { ackId, targetWs } = await roomManager.relayMessage(body.token, body.id, body.d);
        
        // If the target peer is actively connected to the same instance via WebSocket, push immediately
        if (targetWs && targetWs.readyState === 1) {
          targetWs.send(JSON.stringify({ t: 'msg', id: body.id, d: body.d, ts: Date.now() }));
        }

        return NextResponse.json({ t: 'ack', id: ackId });
      }

      case 'poll': {
        const result = await roomManager.pollMessages(body.token, body.role);
        if (!result) return NextResponse.json({ t: 'expired' });

        return NextResponse.json({
          t: 'poll_result',
          peerConnected: result.peerConnected,
          messages: result.messages,
        });
      }

      case 'leave': {
        if (body.token) await roomManager.leaveRoom(body.token);
        return NextResponse.json({ t: 'ok' });
      }

      default:
        return NextResponse.json({ t: 'err', msg: 'Unknown command' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ t: 'err', msg: err.message }, { status: 400 });
  }
}
