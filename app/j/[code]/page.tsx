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
        onRoleChange={() => {}}
        onGoHome={() => { window.location.href = '/'; }}
        peerConnected={socket.peerConnected}
        connected={socket.connected}
      />

      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
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
      </div>
    </main>
  );
}
