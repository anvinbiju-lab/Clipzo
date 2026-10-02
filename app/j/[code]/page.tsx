'use client';

import React, { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '../../../components/Header';
import { SenderView } from '../../../components/SenderView';
import { useQuickDropSocket } from '../../../lib/useQuickDropSocket';

export default function JoinPage() {
  const params = useParams();
  const rawCode = typeof params.code === 'string' ? params.code : '';
  const socket = useQuickDropSocket('send');

  const normalizedCode = rawCode.trim().toUpperCase();

  // Automatically attempt joining upon mounting with the URL code
  const hasRequestedJoin = useRef(false);
  useEffect(() => {
    if (normalizedCode && normalizedCode.length >= 2 && !socket.code && !hasRequestedJoin.current) {
      hasRequestedJoin.current = true;
      socket.joinRoom(normalizedCode, 'send');
    }
  }, [normalizedCode, socket.code, socket.joinRoom]);

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <div>
        <Header
          currentRole="send"
          onRoleChange={() => {}}
          onGoHome={() => {
            window.location.href = '/';
          }}
          peerConnected={socket.peerConnected}
          connected={socket.connected}
        />

        <div className="container mx-auto">
          <SenderView
            code={socket.code}
            connected={socket.connected}
            peerConnected={socket.peerConnected}
            reconnecting={socket.reconnecting}
            error={socket.error}
            expired={socket.expired}
            history={socket.history}
            latestMessage={socket.latestMessage}
            initialCode={rawCode}
            onJoinRoom={(c) => socket.joinRoom(c, 'send')}
            onSendMessage={socket.sendMessage}
            onClearMessage={socket.clearLatestMessage}
            onDisconnect={socket.disconnect}
            onClearError={socket.clearError}
          />
        </div>
      </div>

      <footer className="w-full py-4 text-center text-xs text-neutral-400 dark:text-neutral-600 border-t border-neutral-100 dark:border-neutral-900">
        QuickDrop • Ephemeral transfer
        <span className="ml-2 text-neutral-300 dark:text-neutral-700">Developed By Anvin</span>
      </footer>
    </main>
  );
}
