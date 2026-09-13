'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { PcView } from '../components/PcView';
import { PhoneView } from '../components/PhoneView';
import { useQuickDropSocket } from '../lib/useQuickDropSocket';
import type { Role } from '../types/protocol';

export default function HomePage() {
  const [role, setRole] = useState<Role>('pc');
  const [hasDetectedRole, setHasDetectedRole] = useState(false);

  // Auto-detect mobile vs desktop on initial client mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasDetectedRole) {
      const ua = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
      if (isMobile) {
        setRole('phone');
      } else {
        setRole('pc');
      }
      setHasDetectedRole(true);
    }
  }, [hasDetectedRole]);

  const socket = useQuickDropSocket(role);

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <div>
        <Header
          currentRole={role}
          onRoleChange={(newRole) => {
            setRole(newRole);
            socket.clearError();
          }}
          peerConnected={socket.peerConnected}
          connected={socket.connected}
        />

        <div className="container mx-auto">
          {role === 'pc' ? (
            <PcView
              code={socket.code}
              connected={socket.connected}
              peerConnected={socket.peerConnected}
              reconnecting={socket.reconnecting}
              error={socket.error}
              expired={socket.expired}
              latestMessage={socket.latestMessage}
              history={socket.history}
              onCreateRoom={socket.createRoom}
              onDisconnect={socket.disconnect}
              onClearMessage={socket.clearLatestMessage}
            />
          ) : (
            <PhoneView
              code={socket.code}
              connected={socket.connected}
              peerConnected={socket.peerConnected}
              reconnecting={socket.reconnecting}
              error={socket.error}
              expired={socket.expired}
              history={socket.history}
              onJoinRoom={(c) => socket.joinRoom(c, 'phone')}
              onSendMessage={socket.sendMessage}
              onDisconnect={socket.disconnect}
              onClearError={socket.clearError}
            />
          )}
        </div>
      </div>

      <footer className="w-full py-4 text-center text-xs text-neutral-400 dark:text-neutral-600 border-t border-neutral-100 dark:border-neutral-900">
        QuickDrop • Ephemeral text transfer
      </footer>
    </main>
  );
}
