'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, Role, SnippetItem } from '../types/protocol';
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
  const isHttpMode = useRef<boolean>(
    typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('vercel.app') ||
        window.location.hostname.includes('vercel'))
  );
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAcksRef = useRef<Map<string, (success: boolean) => void>>(new Map());
  const manualDisconnectRef = useRef<boolean>(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (initialRole && !state.role) {
      setState((prev) => ({ ...prev, role: initialRole }));
    }
  }, [initialRole, state.role]);

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
    if (!msg || typeof msg !== 'object') return;

    switch (msg.t) {
      case 'created': {
        const role = msg.role || 'send';
        const token = msg.token || msg.pcToken;
        sessionStorage.setItem(STORAGE_KEYS.ROOM_CODE, msg.code);
        sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
        sessionStorage.setItem(STORAGE_KEYS.ROLE, role);
        setState((prev) => ({
          ...prev,
          connected: true,
          code: msg.code,
          token,
          role,
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
          peerConnected: msg.peerConnected || false,
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
        const item: SnippetItem = { id: msg.id, text: msg.d, timestamp: msg.ts || Date.now() };
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

  // Polling loop: active whenever token is present and HTTP mode is enabled
  useEffect(() => {
    if (!state.token || !isHttpMode.current) return;

    let isPolling = false;
    let isCancelled = false;

    const poll = async () => {
      if (isPolling || isCancelled || !stateRef.current.token) return;
      isPolling = true;
      try {
        const res = await sendHttp({ t: 'poll', token: stateRef.current.token });
        if (isCancelled) return;
        if (res) {
          if (res.t === 'poll_result') {
            setState((prev) => {
              const changedPeer = prev.peerConnected !== res.peerConnected;
              const changedConn = !prev.connected;
              if (changedPeer || changedConn) {
                return { ...prev, peerConnected: res.peerConnected, connected: true, reconnecting: false };
              }
              return prev;
            });

            if (res.messages && Array.isArray(res.messages)) {
              for (const m of res.messages) {
                const parsed = typeof m === 'string' ? JSON.parse(m) : m;
                handleMessage(parsed);
              }
            }
          } else if (res.t === 'expired') {
            handleMessage(res);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      } finally {
        isPolling = false;
      }
    };

    poll();
    const interval = setInterval(poll, 1000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [state.token, handleMessage]);

  const connectWs = useCallback((onOpenCallback?: () => void) => {
    if (typeof window === 'undefined') return;
    if (isHttpMode.current) {
      if (onOpenCallback) onOpenCallback();
      return;
    }

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
      }, 2000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        isHttpMode.current = false;
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, connected: true, reconnecting: false, error: null }));
        if (onOpenCallback) onOpenCallback();
      };

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch {}
      };

      ws.onclose = () => {
        isHttpMode.current = true;
        setState((prev) => ({ ...prev, connected: !!prev.token }));
        if (onOpenCallback) onOpenCallback();
      };

      ws.onerror = () => {
        isHttpMode.current = true;
      };
    } catch {
      isHttpMode.current = true;
    }
  }, [handleMessage]);

  const createRoom = useCallback(
    async (role: Role = 'send') => {
      manualDisconnectRef.current = false;
      setState((prev) => ({ ...prev, error: null, expired: false, role }));

      if (!isHttpMode.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ t: 'create', role }));
      } else if (!isHttpMode.current) {
        connectWs(async () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ t: 'create', role }));
          } else {
            const res = await sendHttp({ t: 'create', role });
            if (res && res.t === 'created') {
              handleMessage(res);
            } else {
              setState((prev) => ({ ...prev, error: res?.msg || 'Failed to create room' }));
            }
          }
        });
      } else {
        const res = await sendHttp({ t: 'create', role });
        if (res && res.t === 'created') {
          handleMessage(res);
        } else {
          setState((prev) => ({ ...prev, error: res?.msg || 'Failed to create room' }));
        }
      }
    },
    [connectWs, handleMessage]
  );

  const joinRoom = useCallback(
    async (code: string, role: Role = 'receive') => {
      manualDisconnectRef.current = false;
      const cleanCode = code.trim().toUpperCase();
      setState((prev) => ({ ...prev, error: null, expired: false, role }));

      const storedCode = sessionStorage.getItem(STORAGE_KEYS.ROOM_CODE);
      const existingToken = (storedCode === cleanCode)
        ? sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) || undefined
        : undefined;

      if (!isHttpMode.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ t: 'join', code: cleanCode, role, token: existingToken }));
      } else if (!isHttpMode.current) {
        connectWs(async () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ t: 'join', code: cleanCode, role, token: existingToken }));
          } else {
            const res = await sendHttp({ t: 'join', code: cleanCode, role, token: existingToken });
            if (res && res.t === 'joined') {
              handleMessage(res);
            } else {
              setState((prev) => ({ ...prev, error: res?.msg || 'Room not found or expired' }));
            }
          }
        });
      } else {
        const res = await sendHttp({ t: 'join', code: cleanCode, role, token: existingToken });
        if (res && res.t === 'joined') {
          handleMessage(res);
        } else {
          setState((prev) => ({ ...prev, error: res?.msg || 'Room not found or expired' }));
        }
      }
    },
    [connectWs, handleMessage]
  );

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!stateRef.current.token) return false;

      const id = Math.random().toString(36).substring(2, 10);

      if (!isHttpMode.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return new Promise<boolean>((resolve) => {
          pendingAcksRef.current.set(id, (success) => {
            if (success) {
              const item: SnippetItem = { id, text, timestamp: Date.now() };
              setState((prev) => ({
                ...prev,
                history: [item, ...prev.history.filter((m) => m.id !== id)].slice(0, MAX_HISTORY_ITEMS),
              }));
            }
            resolve(success);
          });

          const timeout = setTimeout(() => {
            if (pendingAcksRef.current.has(id)) {
              pendingAcksRef.current.delete(id);
              resolve(false);
            }
          }, 8000);

          wsRef.current?.send(JSON.stringify({ t: 'msg', id, d: text, token: stateRef.current.token }));
        });
      } else {
        isHttpMode.current = true;
        const res = await sendHttp({ t: 'msg', id, d: text, token: stateRef.current.token });
        if (res && res.t === 'ack') {
          const item: SnippetItem = { id, text, timestamp: Date.now() };
          setState((prev) => ({
            ...prev,
            history: [item, ...prev.history.filter((m) => m.id !== id)].slice(0, MAX_HISTORY_ITEMS),
          }));
          return true;
        } else {
          setState((prev) => ({ ...prev, error: res?.msg || 'Failed to send message' }));
          return false;
        }
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    if (stateRef.current.token) {
      if (!isHttpMode.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ t: 'leave', token: stateRef.current.token })); } catch {}
      } else {
        sendHttp({ t: 'leave', token: stateRef.current.token });
      }
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
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
  }, []);

  const clearError = useCallback(() => setState((prev) => ({ ...prev, error: null })), []);
  const clearLatestMessage = useCallback(() => setState((prev) => ({ ...prev, latestMessage: null })), []);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
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
