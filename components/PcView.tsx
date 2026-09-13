'use client';

import React, { useEffect, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { PRIVACY_STATEMENT } from '../lib/constants';
import type { SnippetItem } from '../types/protocol';
import { QrCodeModal } from './QrCodeModal';

interface PcViewProps {
  code: string | null;
  connected: boolean;
  peerConnected: boolean;
  reconnecting: boolean;
  error: string | null;
  expired: boolean;
  latestMessage: SnippetItem | null;
  history: SnippetItem[];
  onCreateRoom: () => void;
  onDisconnect: () => void;
  onClearMessage: () => void;
}

export function PcView({
  code,
  connected,
  peerConnected,
  reconnecting,
  error,
  expired,
  latestMessage,
  history,
  onCreateRoom,
  onDisconnect,
  onClearMessage,
}: PcViewProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);

  // Auto-trigger room creation if not yet initialized
  useEffect(() => {
    if (!code && !expired) {
      onCreateRoom();
    }
  }, [code, expired, onCreateRoom]);

  const handleCopy = async (text: string, isMain: boolean = true) => {
    const success = await copyToClipboard(text);
    if (success) {
      if (isMain) {
        setCopyStatus('Copied ✓');
        setTimeout(() => setCopyStatus(null), 2500);
      }
    } else {
      if (isMain) {
        setCopyStatus('Unable to copy');
        setTimeout(() => setCopyStatus(null), 2500);
      }
    }
  };

  const handleCopyAndClear = async (text: string) => {
    await handleCopy(text, true);
    setTimeout(() => {
      onClearMessage();
    }, 500);
  };

  const joinUrl = typeof window !== 'undefined' && code ? `${window.location.origin}/j/${code}` : '';

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-12 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-xl mb-4">
          ⏱️
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Session Expired</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 mb-6">
          This temporary room has expired and all session data was deleted.
        </p>
        <button
          type="button"
          onClick={onCreateRoom}
          className="w-full py-3 px-6 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold rounded-xl shadow-sm transition-colors text-sm"
        >
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center">
      {error && (
        <div className="w-full mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm text-center font-medium">
          {error}
        </div>
      )}

      {/* Main Room Card */}
      <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 text-center shadow-xs">
        <p className="text-xs uppercase font-bold tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">
          Your PC Code
        </p>

        {code ? (
          <div className="my-2">
            <span className="font-mono text-5xl sm:text-6xl font-black tracking-widest text-neutral-900 dark:text-neutral-50 select-all">
              {code}
            </span>
          </div>
        ) : (
          <div className="py-4">
            <span className="text-neutral-400 text-sm font-medium animate-pulse">
              Generating code...
            </span>
          </div>
        )}

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
          Enter this code on your phone at{' '}
          <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
            {typeof window !== 'undefined' ? window.location.host : 'quickdrop'}
          </span>
        </p>

        {/* Status indicator */}
        <div className="mt-5 flex items-center justify-center space-x-2">
          {reconnecting ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
              Reconnecting…
            </span>
          ) : peerConnected ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
              CONNECTED
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-ping" />
              Waiting for phone…
            </span>
          )}
        </div>

        {/* Secondary options: QR & Disconnect */}
        <div className="mt-6 pt-5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-center space-x-4 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {code && (
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors flex items-center space-x-1"
            >
              <span>📱 Show QR code</span>
            </button>
          )}
          <span>•</span>
          <button
            type="button"
            onClick={onDisconnect}
            className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Received Text Card */}
      {latestMessage && (
        <div className="w-full mt-6 bg-white dark:bg-neutral-900 border-2 border-neutral-900 dark:border-neutral-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                New Received Text
              </h2>
            </div>
            <span className="text-xs text-neutral-400 font-mono">
              {new Date(latestMessage.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 overflow-x-auto max-h-[380px]">
            <pre className="font-mono text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-all leading-relaxed select-all">
              {latestMessage.text}
            </pre>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => handleCopy(latestMessage.text, true)}
              className="flex-1 py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-bold text-base shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{copyStatus || 'COPY'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyAndClear(latestMessage.text)}
              className="py-3.5 px-5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-sm transition-colors"
            >
              Copy & Clear
            </button>
          </div>
        </div>
      )}

      {/* History (Recent 5) */}
      {history.length > 1 && (
        <div className="w-full mt-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3 px-1">
            Recent Snippets ({history.length})
          </h3>
          <div className="space-y-2">
            {history.slice(1).map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-[400px]">
                  {item.text.replace(/\n/g, ' ')}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(item.text);
                    if (ok) {
                      setCopiedHistoryId(item.id);
                      setTimeout(() => setCopiedHistoryId(null), 2000);
                    }
                  }}
                  className="px-3 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium shrink-0 transition-colors"
                >
                  {copiedHistoryId === item.id ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500 text-center">
        {PRIVACY_STATEMENT}
      </p>

      {/* QR Modal */}
      {code && (
        <QrCodeModal
          url={joinUrl}
          code={code}
          isOpen={showQr}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
