'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '../../../components/Header';
import { PhoneView } from '../../../components/PhoneView';
import { useQuickDropSocket } from '../../../lib/useQuickDropSocket';

export default function JoinPage() {
  const params = useParams();
  const rawCode = typeof params.code === 'string' ? params.code : '';
  const socket = useQuickDropSocket('phone');

  // Automatically attempt joining upon mounting with the URL code
  useEffect(() => {
    if (rawCode && rawCode.length === 4 && !socket.code) {
      socket.joinRoom(rawCode, 'phone');
    }
  }, [rawCode, socket]);

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <div>
        <Header
          currentRole="phone"
          onRoleChange={() => {}}
          peerConnected={socket.peerConnected}
          connected={socket.connected}
        />

        <div className="container mx-auto">
          <PhoneView
            code={socket.code}
            connected={socket.connected}
            peerConnected={socket.peerConnected}
            reconnecting={socket.reconnecting}
            error={socket.error}
            expired={socket.expired}
            history={socket.history}
            initialCode={rawCode}
            onJoinRoom={(c) => socket.joinRoom(c, 'phone')}
            onSendMessage={socket.sendMessage}
            onDisconnect={socket.disconnect}
            onClearError={socket.clearError}
          />
        </div>
      </div>

      <footer className="w-full py-4 text-center text-xs text-neutral-400 dark:text-neutral-600 border-t border-neutral-100 dark:border-neutral-900">
        QuickDrop • Ephemeral text transfer
      </footer>
    </main>
  );
}
