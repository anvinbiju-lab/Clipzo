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
    <header className="sticky top-0 z-40 w-full glass-panel border-b-0 border-b border-neutral-200/50 dark:border-neutral-800/50 py-3 px-4 sm:px-8 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center space-x-3 group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-black text-white text-sm shadow-md group-hover:scale-105 transition-transform">
            QD
          </div>
          <div className="text-left hidden sm:block">
            <h1 className="text-lg font-extrabold tracking-tight text-neutral-900 dark:text-white leading-none">
              QuickDrop
            </h1>
          </div>
        </button>

        {/* Role Toggle */}
        <div className="flex items-center space-x-1.5 p-1 rounded-xl glass-panel-heavy shadow-inner bg-black/5 dark:bg-white/5">
          <button
            type="button"
            onClick={() => onRoleChange('receive')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 cursor-pointer ${
              currentRole === 'receive'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-md transform scale-105'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Receive
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('send')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 cursor-pointer ${
              currentRole === 'send'
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-md transform scale-105'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </header>
  );
}
