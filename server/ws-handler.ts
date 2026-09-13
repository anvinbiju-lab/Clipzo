import type { IncomingMessage } from 'node:http';
import type { WebSocket, WebSocketServer } from 'ws';
import { roomManager } from './room-manager';
import type { ClientMessage, ServerMessage } from '../types/protocol';

function sendJson(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(msg));
  }
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function setupWebSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = getClientIp(req);
    let assignedToken: string | null = null;

    ws.on('message', (rawData: Buffer | string) => {
      try {
        const text = rawData.toString();
        const msg = JSON.parse(text) as ClientMessage;

        switch (msg.t) {
          case 'create': {
            try {
              const { code, pcToken } = roomManager.createRoom(ip);
              assignedToken = pcToken;
              const joinResult = roomManager.joinRoom(code, 'pc', pcToken, ws, ip);
              sendJson(ws, {
                t: 'created',
                code,
                pcToken,
              });
              sendJson(ws, {
                t: 'joined',
                role: 'pc',
                token: pcToken,
                code,
                peerConnected: joinResult.peerConnected,
              });
            } catch (err: unknown) {
              const error = err as Error;
              sendJson(ws, { t: 'err', msg: error.message || 'Failed to create room' });
            }
            break;
          }

          case 'join': {
            try {
              const result = roomManager.joinRoom(msg.code, msg.role, msg.token, ws, ip);
              assignedToken = result.token;
              sendJson(ws, {
                t: 'joined',
                role: result.role,
                token: result.token,
                code: result.code,
                peerConnected: result.peerConnected,
              });

              // Notify peer if present
              const room = roomManager.getRoom(result.code);
              if (room) {
                const peerWs = result.role === 'phone' ? room.pcWs : room.phoneWs;
                if (peerWs && peerWs.readyState === 1) {
                  sendJson(peerWs, { t: 'peer_joined' });
                }
              }
            } catch (err: unknown) {
              const error = err as Error;
              sendJson(ws, { t: 'err', msg: error.message || 'Failed to join room' });
            }
            break;
          }

          case 'msg': {
            try {
              if (!msg.d || typeof msg.d !== 'string') {
                sendJson(ws, { t: 'err', msg: 'Message cannot be empty' });
                return;
              }
              const { targetWs, ackId } = roomManager.relayMessage(msg.token, msg.id, msg.d);

              // Immediate delivery ACK to sender
              sendJson(ws, { t: 'ack', id: ackId });

              // Forward exact text to target peer
              if (targetWs && targetWs.readyState === 1) {
                sendJson(targetWs, {
                  t: 'msg',
                  id: msg.id,
                  d: msg.d, // exact byte-for-byte preservation
                  ts: Date.now(),
                });
              }
            } catch (err: unknown) {
              const error = err as Error;
              sendJson(ws, { t: 'err', msg: error.message || 'Failed to send message' });
            }
            break;
          }

          case 'leave': {
            if (msg.token) {
              roomManager.leaveRoom(msg.token);
            }
            break;
          }

          case 'ping': {
            sendJson(ws, { t: 'pong' });
            break;
          }

          default:
            sendJson(ws, { t: 'err', msg: 'Malformed message' });
            break;
        }
      } catch {
        sendJson(ws, { t: 'err', msg: 'Malformed JSON payload' });
      }
    });

    ws.on('close', () => {
      const result = roomManager.handleDisconnect(ws);
      if (result && result.peerWs && result.peerWs.readyState === 1) {
        sendJson(result.peerWs, { t: 'peer_left' });
      }
    });

    ws.on('error', () => {
      // Sockets will close and trigger close event
    });
  });
}
