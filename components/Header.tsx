'use client';

import React from 'react';
import type { Role } from '../types/protocol';

interface HeaderProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  onGoHome: () => void;
  peerConnected: boolean;
  connected: boolean;
}

export function Header({ currentRole, onRoleChange, onGoHome }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 w-full py-3 px-4 sm:px-6"
      style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--fg)' }}>
            Clipzo
          </span>
        </button>

        <div
          className="flex items-center p-0.5 rounded-lg"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <button
            type="button"
            onClick={() => onRoleChange('send')}
            className="px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: currentRole === 'send' ? 'var(--bg)' : 'transparent',
              color: currentRole === 'send' ? 'var(--fg)' : 'var(--fg-muted)',
              boxShadow: currentRole === 'send' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('receive')}
            className="px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: currentRole === 'receive' ? 'var(--bg)' : 'transparent',
              color: currentRole === 'receive' ? 'var(--fg)' : 'var(--fg-muted)',
              boxShadow: currentRole === 'receive' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Receive
          </button>
        </div>
      </div>
    </header>
  );
}
