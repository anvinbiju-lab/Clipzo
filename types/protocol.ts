/**
 * WebSocket Protocol Types for QuickDrop
 * Compact, typed, minimal JSON protocol
 */

export type Role = 'pc' | 'phone';

// Client -> Server messages
export type ClientMessage =
  | { t: 'create' }
  | { t: 'join'; code: string; role: Role; token?: string }
  | { t: 'msg'; id: string; d: string; token: string }
  | { t: 'leave'; token: string }
  | { t: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { t: 'created'; code: string; pcToken: string }
  | { t: 'joined'; role: Role; token: string; code: string; peerConnected: boolean }
  | { t: 'peer_joined' }
  | { t: 'peer_left' }
  | { t: 'msg'; id: string; d: string; ts: number }
  | { t: 'ack'; id: string }
  | { t: 'pong' }
  | { t: 'err'; msg: string; code?: string }
  | { t: 'expired' };

// Transfer snippet item in-memory
export interface SnippetItem {
  id: string;
  text: string;
  timestamp: number;
}
