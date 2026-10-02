'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { ReceiverView } from '../components/ReceiverView';
import { SenderView } from '../components/SenderView';
import { useQuickDropSocket } from '../lib/useQuickDropSocket';
import type { Role } from '../types/protocol';

function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden min-h-screen">
      {/* Decorative background blur elements */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center w-full max-w-lg">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-blue-500/25 mb-8 transform transition-transform hover:scale-105">
          QD
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-900 dark:text-white mb-5 text-center leading-tight">
          Share instantly.<br/>
          <span className="text-gradient">No limits.</span>
        </h1>
        <p className="text-base sm:text-lg text-neutral-500 dark:text-neutral-400 mb-12 text-center max-w-sm font-medium">
          Ultra-fast, ephemeral text and file transfer. Works securely across all your devices.
        </p>

        <div className="w-full space-y-4">
          <button
            type="button"
            onClick={() => onSelect('send')}
            className="w-full group glass-panel glass-panel-hover rounded-3xl p-6 sm:p-8 text-left transition-all duration-300 cursor-pointer overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex items-center space-x-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                📤
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Send
                </h2>
                <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 mt-1">
                  Create a room to drop files & text.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('receive')}
            className="w-full group glass-panel glass-panel-hover rounded-3xl p-6 sm:p-8 text-left transition-all duration-300 cursor-pointer overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex items-center space-x-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                📥
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Receive
                </h2>
                <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 mt-1">
                  Enter a code to collect your files.
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="mt-14 text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 text-center opacity-70">
          Zero signup • Ephemeral • 100% free
        </p>
      </div>
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

  if (!hasMounted) return <main className="min-h-screen"></main>;

  if (!role) {
    return (
      <main className="min-h-screen flex flex-col bg-mesh">
        <RoleSelector onSelect={setRole} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-mesh relative">
      {/* Decorative ambient blobs for active session */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
      
      <div className="flex-1 flex flex-col relative z-10">
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

        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 flex-1">
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
    </main>
  );
}
