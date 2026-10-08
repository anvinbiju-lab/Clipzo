'use client';

import React, { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '../../../components/Header';
import { ReceiverView } from '../../../components/ReceiverView';
import { useQuickDropSocket } from '../../../lib/useQuickDropSocket';

export default function JoinPage() {
  const params = useParams();
  const rawCode = typeof params.code === 'string' ? params.code : '';
  const socket = useQuickDropSocket('receive');

  const normalizedCode = rawCode.trim().toUpperCase();

  const hasRequestedJoin = useRef(false);
  useEffect(() => {
    if (normalizedCode && normalizedCode.length >= 2 && !socket.code && !hasRequestedJoin.current) {
      hasRequestedJoin.current = true;
      socket.joinRoom(normalizedCode, 'receive');
    }
  }, [normalizedCode, socket.code, socket.joinRoom]);

  return (
    <main className="min-h-screen flex flex-col">
      <Header
        currentRole="receive"
        onRoleChange={(newRole) => {
          if (newRole === 'send') {
            socket.disconnect();
            window.location.href = '/';
          }
        }}
        onGoHome={() => {
          socket.disconnect();
          window.location.href = '/';
        }}
        peerConnected={socket.peerConnected}
        connected={socket.connected}
      />

      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        {!socket.code && !socket.error && normalizedCode.length >= 2 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin mb-3 mx-auto" style={{ color: 'var(--accent)' }} />
            <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Connecting to room {normalizedCode}…</div>
            <div className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>Establishing connection</div>
          </div>
        ) : (
          <ReceiverView
            code={socket.code}
            connected={socket.connected}
            peerConnected={socket.peerConnected}
            reconnecting={socket.reconnecting}
            error={socket.error}
            expired={socket.expired}
            latestMessage={socket.latestMessage}
            history={socket.history}
            initialCode={rawCode}
            onJoinRoom={(c) => socket.joinRoom(c, 'receive')}
            onDisconnect={socket.disconnect}
            onClearMessage={socket.clearLatestMessage}
            onClearError={socket.clearError}
          />
        )}
      </div>
    </main>
  );
}
