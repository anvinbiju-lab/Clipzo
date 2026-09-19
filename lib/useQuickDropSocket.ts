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
  const isHttpMode = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAcksRef = useRef<Map<string, (success: boolean) => void>>(new Map());
  const manualDisconnectRef = useRef<boolean>(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const sendHttp = async (payload: any) => {
    try {
      const res = await fetch('/api/quickdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return null;
    }
  };

  const handleMessage = useCallback((msg: any) => {
    switch (msg.t) {
      case 'created': {
        sessionStorage.setItem(STORAGE_KEYS.ROOM_CODE, msg.code);
        sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, msg.pcToken);
        sessionStorage.setItem(STORAGE_KEYS.ROLE, 'pc');
        setState((prev) => ({
          ...prev,
          connected: true,
          code: msg.code,
          token: msg.pcToken,
          role: 'pc',
          peerConnected: msg.peerConnected || false,
          expired: false,
          error: null,
        }));
        break;
      }
      case 'joined': {
        sessionStorage.setItem(STORAGE_KEYS.ROOM_CODE, msg.code);
        sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, msg.token);
        sessionStorage.setItem(STORAGE_KEYS.ROLE, msg.role);
        setState((prev) => ({
          ...prev,
          connected: true,
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
        const item: SnippetItem = { id: msg.id, text: msg.d, timestamp: msg.ts };
        setState((prev) => {
          if (prev.latestMessage?.id === msg.id) return prev;
          const newHistory = [item, ...prev.history.filter((m) => m.id !== msg.id)].slice(0, MAX_HISTORY_ITEMS);
          return { ...prev, latestMessage: item, history: newHistory };
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
  }, []);

  const send = useCallback(async (msg: ClientMessage) => {
    if (isHttpMode.current) {
      const result = await sendHttp(msg);
      if (result) {
        handleMessage(result);
        return true;
      }
      return false;
    } else {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
        return true;
      }
      return false;
    }
  }, [handleMessage]);

  const connect = useCallback((onOpenCallback?: () => void) => {
    if (typeof window === 'undefined') return;

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        isHttpMode.current = false;
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, connected: true, reconnecting: false, error: null }));

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping' }));
        }, 15000);

        if (onOpenCallback) onOpenCallback();
      };

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch {}
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        
        // Fallback to HTTP Mode if WS fails entirely
        if (!stateRef.current.code && !stateRef.current.token) {
           isHttpMode.current = true;
           if (onOpenCallback) onOpenCallback();
           
           // Start HTTP Polling loop
           pingIntervalRef.current = setInterval(async () => {
             if (stateRef.current.token) {
               const res = await sendHttp({ t: 'poll', token: stateRef.current.token, role: stateRef.current.role });
               if (res && res.t === 'poll_result') {
                 if (res.peerConnected !== stateRef.current.peerConnected) {
                   setState((prev) => ({ ...prev, peerConnected: res.peerConnected }));
                 }
                 if (res.messages) {
                   res.messages.forEach((m: any) => handleMessage(m));
                 }
               } else if (res && res.t === 'expired') {
                 handleMessage(res);
               }
             }
           }, 2000);
           return;
        }

        setState((prev) => ({ ...prev, connected: false }));

        if (manualDisconnectRef.current) {
          manualDisconnectRef.current = false;
          return;
        }

        setState((prev) => {
          if (!prev.expired && (prev.code || prev.token) && !isHttpMode.current) {
            const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 10000);
            reconnectAttemptsRef.current++;

            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              setState((s) => ({ ...s, reconnecting: true }));
              connect(() => {
                const storedCode = sessionStorage.getItem(STORAGE_KEYS.ROOM_CODE);
                const storedToken = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
                const storedRole = sessionStorage.getItem(STORAGE_KEYS.ROLE) as Role | null;

                if (storedCode && storedToken && storedRole) {
                  send({ t: 'join', code: storedCode, role: storedRole, token: storedToken });
                }
              });
            }, delay);
          }
          return prev;
        });
      };

      ws.onerror = () => {
         // Silently fail and let onclose handle the HTTP fallback
      };
    } catch {
      setState((prev) => ({ ...prev, error: 'Connection error' }));
    }
  }, [handleMessage, send]);

  const createRoom = useCallback(() => {
    manualDisconnectRef.current = false;
    setState((prev) => ({ ...prev, error: null, expired: false }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      send({ t: 'create' });
    } else if (isHttpMode.current) {
      send({ t: 'create' });
    } else {
      connect(() => {
        send({ t: 'create' });
      });
    }
  }, [connect, send]);

  const joinRoom = useCallback(
    (code: string, role: Role = 'phone') => {
      manualDisconnectRef.current = false;
      setState((prev) => ({ ...prev, error: null, expired: false, role }));

      const existingToken = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) || undefined;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        send({ t: 'join', code, role, token: existingToken });
      } else if (isHttpMode.current) {
        send({ t: 'join', code, role, token: existingToken });
      } else {
        connect(() => {
          send({ t: 'join', code, role, token: existingToken });
        });
      }
    },
    [connect, send]
  );

  const sendMessage = useCallback(
    (text: string): Promise<boolean> => {
      return new Promise(async (resolve) => {
        if (!state.token) return resolve(false);

        const id = Math.random().toString(36).substring(2, 10);
        
        pendingAcksRef.current.set(id, (success) => {
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

        // Set local timeout for ack
        const timeout = setTimeout(() => {
          if (pendingAcksRef.current.has(id)) {
            pendingAcksRef.current.delete(id);
            resolve(false);
          }
        }, 8000);

        const sent = await send({ t: 'msg', id, d: text, token: state.token });

        if (!sent) {
          clearTimeout(timeout);
          pendingAcksRef.current.delete(id);
          resolve(false);
        } else if (isHttpMode.current) {
          // HTTP mode immediately resolves ack from the POST response
          clearTimeout(timeout);
        }
      });
    },
    [send, state.token]
  );

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    if (state.token) {
      send({ t: 'leave', token: state.token });
    }
    if (wsRef.current) wsRef.current.close();
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    
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

  const clearError = useCallback(() => setState((prev) => ({ ...prev, error: null })), []);
  const clearLatestMessage = useCallback(() => setState((prev) => ({ ...prev, latestMessage: null })), []);

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
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
