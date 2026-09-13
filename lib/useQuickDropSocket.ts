'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, Role, ServerMessage, SnippetItem } from '../types/protocol';
import { MAX_HISTORY_ITEMS, STORAGE_KEYS } from './constants';

export interface QuickDropState {
  connected: boolean;
  peerConnected: boolean;
  reconnecting: boolean;
  code: string | null;
  token: string | null;
  role: Role | null;
  error: string | null;
  expired: boolean;
  latestMessage: SnippetItem | null;
  history: SnippetItem[];
}

export function useQuickDropSocket(initialRole?: Role) {
  const [state, setState] = useState<QuickDropState>({
    connected: false,
    peerConnected: false,
    reconnecting: false,
    code: null,
    token: null,
    role: initialRole || null,
    error: null,
    expired: false,
    latestMessage: null,
    history: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAcksRef = useRef<Map<string, (success: boolean) => void>>(new Map());
  const manualDisconnectRef = useRef<boolean>(false);

  // Helper to send typed message
  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  // Connect to WebSocket server
  const connect = useCallback((onOpenCallback?: () => void) => {
    if (typeof window === 'undefined') return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, connected: true, reconnecting: false, error: null }));

        // Start ping heartbeat every 15s
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ t: 'ping' }));
          }
        }, 15000);

        if (onOpenCallback) {
          onOpenCallback();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;

          switch (msg.t) {
            case 'created': {
              sessionStorage.setItem(STORAGE_KEYS.ROOM_CODE, msg.code);
              sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, msg.pcToken);
              sessionStorage.setItem(STORAGE_KEYS.ROLE, 'pc');
              setState((prev) => ({
                ...prev,
                code: msg.code,
                token: msg.pcToken,
                role: 'pc',
                expired: false,
              }));
              break;
            }

            case 'joined': {
              sessionStorage.setItem(STORAGE_KEYS.ROOM_CODE, msg.code);
              sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, msg.token);
              sessionStorage.setItem(STORAGE_KEYS.ROLE, msg.role);
              setState((prev) => ({
                ...prev,
                code: msg.code,
                token: msg.token,
                role: msg.role,
                peerConnected: msg.peerConnected,
                expired: false,
                error: null,
              }));
              break;
            }

            case 'peer_joined': {
              setState((prev) => ({ ...prev, peerConnected: true }));
              break;
            }

            case 'peer_left': {
              setState((prev) => ({ ...prev, peerConnected: false }));
              break;
            }

            case 'msg': {
              const item: SnippetItem = {
                id: msg.id,
                text: msg.d,
                timestamp: msg.ts,
              };
              setState((prev) => {
                // Deduplicate
                if (prev.latestMessage?.id === msg.id) return prev;
                const newHistory = [item, ...prev.history.filter((m) => m.id !== msg.id)].slice(
                  0,
                  MAX_HISTORY_ITEMS
                );
                return {
                  ...prev,
                  latestMessage: item,
                  history: newHistory,
                };
              });
              break;
            }

            case 'ack': {
              const resolver = pendingAcksRef.current.get(msg.id);
              if (resolver) {
                resolver(true);
                pendingAcksRef.current.delete(msg.id);
              }
              break;
            }

            case 'pong': {
              break;
            }

            case 'err': {
              setState((prev) => ({ ...prev, error: msg.msg }));
              break;
            }

            case 'expired': {
              sessionStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
              sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
              sessionStorage.removeItem(STORAGE_KEYS.ROLE);
              setState((prev) => ({
                ...prev,
                connected: false,
                peerConnected: false,
                expired: true,
                code: null,
                token: null,
              }));
              break;
            }
          }
        } catch {
          // ignore malformed message
        }
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        setState((prev) => ({ ...prev, connected: false }));

        if (manualDisconnectRef.current) {
          manualDisconnectRef.current = false;
          return;
        }

        // Reconnect with exponential backoff if not explicitly expired
        setState((prev) => {
          if (!prev.expired && (prev.code || prev.token)) {
            const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 10000);
            reconnectAttemptsRef.current++;

            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              setState((s) => ({ ...s, reconnecting: true }));
              connect(() => {
                // Re-authenticate with stored token/code
                const storedCode = sessionStorage.getItem(STORAGE_KEYS.ROOM_CODE);
                const storedToken = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
                const storedRole = sessionStorage.getItem(STORAGE_KEYS.ROLE) as Role | null;

                if (storedCode && storedToken && storedRole) {
                  send({
                    t: 'join',
                    code: storedCode,
                    role: storedRole,
                    token: storedToken,
                  });
                }
              });
            }, delay);
          }
          return prev;
        });
      };

      ws.onerror = () => {
        setState((prev) => ({ 
          ...prev, 
          error: !prev.code ? 'Unable to connect to server. Ensure you ran "npm run dev" (tsx server.ts).' : 'Connection error' 
        }));
      };
    } catch {
      setState((prev) => ({ ...prev, error: 'Connection error' }));
    }
  }, [send]);

  // Create room (PC action)
  const createRoom = useCallback(() => {
    manualDisconnectRef.current = false;
    setState((prev) => ({ ...prev, error: null, expired: false }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      send({ t: 'create' });
    } else {
      connect(() => {
        send({ t: 'create' });
      });
    }
  }, [connect, send]);

  // Join room (Phone action)
  const joinRoom = useCallback(
    (code: string, role: Role = 'phone') => {
      manualDisconnectRef.current = false;
      setState((prev) => ({ ...prev, error: null, expired: false, role }));

      const existingToken = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) || undefined;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        send({ t: 'join', code, role, token: existingToken });
      } else {
        connect(() => {
          send({ t: 'join', code, role, token: existingToken });
        });
      }
    },
    [connect, send]
  );

  // Send message
  const sendMessage = useCallback(
    (text: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!state.token) {
          resolve(false);
          return;
        }

        const id = Math.random().toString(36).substring(2, 10);
        const timeout = setTimeout(() => {
          if (pendingAcksRef.current.has(id)) {
            pendingAcksRef.current.delete(id);
            resolve(false);
          }
        }, 8000);

        pendingAcksRef.current.set(id, (success) => {
          clearTimeout(timeout);
          if (success) {
            const item: SnippetItem = { id, text, timestamp: Date.now() };
            setState((prev) => ({
              ...prev,
              latestMessage: item,
              history: [item, ...prev.history].slice(0, MAX_HISTORY_ITEMS),
            }));
          }
          resolve(success);
        });

        const sent = send({
          t: 'msg',
          id,
          d: text,
          token: state.token,
        });

        if (!sent) {
          clearTimeout(timeout);
          pendingAcksRef.current.delete(id);
          resolve(false);
        }
      });
    },
    [send, state.token]
  );

  // Explicit disconnect
  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    if (state.token) {
      send({ t: 'leave', token: state.token });
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    sessionStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.ROLE);

    setState({
      connected: false,
      peerConnected: false,
      reconnecting: false,
      code: null,
      token: null,
      role: null,
      error: null,
      expired: false,
      latestMessage: null,
      history: [],
    });
  }, [send, state.token]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearLatestMessage = useCallback(() => {
    setState((prev) => ({ ...prev, latestMessage: null }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    sendMessage,
    disconnect,
    clearError,
    clearLatestMessage,
  };
}
