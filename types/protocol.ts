/**
 * WebSocket Protocol Types for QuickDrop
 * Compact, typed, minimal JSON protocol
 */

export type Role = 'send' | 'receive' | 'phone' | 'pc';

// Client -> Server messages
export type ClientMessage =
  | { t: 'create'; role?: Role }
  | { t: 'join'; code: string; role: Role; token?: string }
  | { t: 'msg'; id: string; d: string; token: string }
  | { t: 'leave'; token: string }
  | { t: 'destroy'; token: string }
  | { t: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { t: 'created'; code: string; pcToken?: string; token?: string; role?: Role; initialPayload?: string }
  | { t: 'joined'; role: Role; token: string; code: string; peerConnected: boolean; initialPayload?: string }
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

// Lab / batch program item
export interface LabProgramItem {
  id: string;
  name: string;
  code: string;
  lang?: string;
}

export const PROGRAMS_PREFIX = 'PROGRAMS::';
