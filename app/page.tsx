'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { ReceiverView } from '../components/ReceiverView';
import { SenderView } from '../components/SenderView';
import { useQuickDropSocket } from '../lib/useQuickDropSocket';
import type { Role } from '../types/protocol';

function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center font-black text-white dark:text-neutral-900 text-sm shadow-sm mb-4">
        QD
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
        QuickDrop
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-10 text-center max-w-xs">
        Transfer text & files between devices instantly. No login. Ephemeral.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <button
          type="button"
          onClick={() => onSelect('send')}
          className="w-full group relative overflow-hidden bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-6 text-left transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-2xl shrink-0">
              📤
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                Send
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Get a room code. Send text or multiple files.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('receive')}
          className="w-full group relative overflow-hidden bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 hover:border-emerald-500 dark:hover:border-emerald-400 rounded-2xl p-6 text-left transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-2xl shrink-0">
              📥
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                Receive
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Type the sender&apos;s code. Download files & text.
              </p>
            </div>
          </div>
        </button>
      </div>

      <p className="mt-10 text-[11px] text-neutral-400 dark:text-neutral-600 text-center max-w-xs">
        Works on any device — phone, tablet, or computer. All data is deleted when the session ends.
      </p>
    </div>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<Role | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const socket = useQuickDropSocket(role || undefined);

  if (!hasMounted) return <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950"></main>;

  // Show role selector if no role chosen yet
  if (!role) {
    return (
      <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <RoleSelector onSelect={setRole} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <div>
        <Header
          currentRole={role}
          onRoleChange={(newRole) => {
            socket.disconnect();
            setRole(newRole);
            socket.clearError();
          }}
          onGoHome={() => {
            socket.disconnect();
            setRole(null);
          }}
          peerConnected={socket.peerConnected}
          connected={socket.connected}
        />

        <div className="container mx-auto">
          {role === 'receive' ? (
            <ReceiverView
              code={socket.code}
              connected={socket.connected}
              peerConnected={socket.peerConnected}
              reconnecting={socket.reconnecting}
              error={socket.error}
              expired={socket.expired}
              latestMessage={socket.latestMessage}
              history={socket.history}
              onJoinRoom={(c) => socket.joinRoom(c, 'receive')}
              onDisconnect={socket.disconnect}
              onClearMessage={socket.clearLatestMessage}
              onClearError={socket.clearError}
            />
          ) : (
            <SenderView
              code={socket.code}
              connected={socket.connected}
              peerConnected={socket.peerConnected}
              reconnecting={socket.reconnecting}
              error={socket.error}
              expired={socket.expired}
              history={socket.history}
              onCreateRoom={() => socket.createRoom('send')}
              onSendMessage={socket.sendMessage}
              onDisconnect={socket.disconnect}
              onClearError={socket.clearError}
            />
          )}
        </div>
      </div>

      <footer className="w-full py-4 text-center text-xs text-neutral-400 dark:text-neutral-600 border-t border-neutral-100 dark:border-neutral-900">
        QuickDrop • Ephemeral transfer
        <span className="ml-2 text-neutral-300 dark:text-neutral-700">Developed By Anvin</span>
      </footer>
    </main>
  );
}
