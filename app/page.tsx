'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { ReceiverView } from '../components/ReceiverView';
import { SenderView } from '../components/SenderView';
import { useQuickDropSocket } from '../lib/useQuickDropSocket';
import type { Role } from '../types/protocol';

function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 min-h-screen">
      <div className="flex flex-col items-center w-full max-w-sm">
        {/* Icon */}
        <div className="mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--fg)' }}>
          Clipzo
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--fg-muted)' }}>
          Paste on your phone, pick up on any PC.
        </p>

        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={() => onSelect('send')}
            className="w-full card-elevated p-5 text-left transition-all cursor-pointer hover:shadow-md group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-subtle)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Send</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                  Paste code or drop files to share
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('receive')}
            className="w-full card-elevated p-5 text-left transition-all cursor-pointer hover:shadow-md group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--success-subtle)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}>
                  <polyline points="8 17 12 21 16 17" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Receive</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                  Enter code to pick up your content
                </div>
              </div>
            </div>
          </button>
        </div>

        <p className="mt-10 text-[11px] font-medium" style={{ color: 'var(--fg-faint)' }}>
          No signup · No install · Ephemeral
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

  if (!hasMounted) return <main className="min-h-screen" />;

  if (!role) {
    return (
      <main className="min-h-screen flex flex-col">
        <RoleSelector onSelect={setRole} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
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

      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
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
    </main>
  );
}
