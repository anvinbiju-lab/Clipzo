'use client';

import React from 'react';
import type { Role } from '../types/protocol';

interface HeaderProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  peerConnected: boolean;
  connected: boolean;
}

export function Header({ currentRole, onRoleChange, peerConnected, connected }: HeaderProps) {
  return (
    <header className="w-full border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 py-3 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center font-bold text-white dark:text-neutral-900 text-sm shadow-sm">
            QD
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50 leading-none">
              QuickDrop
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 hidden sm:block">
              Phone to PC. No login. Ephemeral.
            </p>
          </div>
        </div>

        {/* Role Toggle */}
        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-lg p-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium">
            <button
              type="button"
              onClick={() => onRoleChange('pc')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                currentRole === 'pc'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-sm font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              💻 PC (Receive)
            </button>
            <button
              type="button"
              onClick={() => onRoleChange('phone')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                currentRole === 'phone'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-sm font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              📱 Phone (Send)
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
