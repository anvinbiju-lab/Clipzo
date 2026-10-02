'use client';

import React, { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { PRIVACY_STATEMENT } from '../lib/constants';
import type { SnippetItem, Role } from '../types/protocol';
import { FileUploader } from './FileUploader';
import { QrCodeModal } from './QrCodeModal';
import { formatSnippetText } from '../lib/utils';

interface SenderViewProps {
  code: string | null;
  connected: boolean;
  peerConnected: boolean;
  reconnecting: boolean;
  error: string | null;
  expired: boolean;
  history: SnippetItem[];
  onCreateRoom: (role?: Role) => void;
  onSendMessage: (text: string) => Promise<boolean>;
  onDisconnect: () => void;
  onClearError: () => void;
}

export function SenderView({
  code,
  connected,
  peerConnected,
  reconnecting,
  error,
  expired,
  history,
  onCreateRoom,
  onSendMessage,
  onDisconnect,
  onClearError,
}: SenderViewProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [textPayload, setTextPayload] = useState('');
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-create room for sender if not initialized
  const hasRequestedRoom = useRef(false);
  useEffect(() => {
    if (!code && !expired && !hasRequestedRoom.current) {
      hasRequestedRoom.current = true;
      onCreateRoom('send');
    }
  }, [code, expired, onCreateRoom]);

  // Focus textarea when room code is ready
  useEffect(() => {
    if (code) {
      textareaRef.current?.focus();
    }
  }, [code]);

  const handleCopyCode = async () => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopyStatus('Code Copied ✓');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const handleSend = async () => {
    if (!textPayload.trim() || sendState === 'sending') return;

    setSendState('sending');
    const success = await onSendMessage(textPayload.trim());

    if (success) {
      setSendState('sent');
      setTextPayload('');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      setTimeout(() => {
        setSendState('idle');
      }, 2500);
    } else {
      setSendState('failed');
      setTimeout(() => {
        setSendState('idle');
      }, 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter key without shift sends the message directly
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
          This temporary session has expired and all session data was deleted.
        </p>
        <button
          type="button"
          onClick={() => {
            hasRequestedRoom.current = false;
            onCreateRoom('send');
          }}
          className="w-full py-3 px-6 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold rounded-xl shadow-sm transition-colors text-sm"
        >
          Start New Send Session
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

      {/* Code Sharing Card */}
      <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col items-center shadow-xs text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
          Your Pairing Code
        </span>

        <div className="relative group cursor-pointer" onClick={handleCopyCode} title="Click to copy code">
          <div className="font-mono text-5xl sm:text-6xl font-black tracking-widest text-neutral-900 dark:text-neutral-50 my-2 select-all transition-transform group-hover:scale-105">
            {code || '··'}
          </div>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {copyStatus || 'Click to copy code'}
          </span>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3 max-w-sm">
          Type this code on the receiving device at{' '}
          <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">
            {typeof window !== 'undefined' ? window.location.host : 'koply.vercel.app'}
          </span>
        </p>

        {/* Peer Status Badge */}
        <div className="mt-5 flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
          <span
            className={`w-2 h-2 rounded-full ${
              reconnecting
                ? 'bg-amber-500 animate-pulse'
                : peerConnected
                ? 'bg-emerald-500'
                : 'bg-neutral-400'
            }`}
          />
          <span>
            {reconnecting
              ? 'Reconnecting…'
              : peerConnected
              ? 'Receiver Connected'
              : 'Waiting for receiver to enter code…'}
          </span>
        </div>

        {/* Secondary Actions */}
        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 w-full flex items-center justify-center space-x-6 text-xs text-neutral-500">
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors flex items-center space-x-1.5 cursor-pointer font-medium"
          >
            <span>📱</span>
            <span>Show QR code</span>
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">•</span>
          <button
            type="button"
            onClick={onDisconnect}
            className="hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer font-medium"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Main Send Text Card */}
      <div className="w-full mt-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
        <label
          htmlFor="drop-textarea"
          className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2"
        >
          Paste text / code
        </label>

        <textarea
          id="drop-textarea"
          ref={textareaRef}
          value={textPayload}
          onChange={(e) => setTextPayload(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste code, URL, or notes here… (Press Enter to send, Shift+Enter for new line)"
          rows={5}
          className="w-full p-3.5 font-mono text-sm leading-relaxed bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-hidden text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 resize-y"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-neutral-400 font-mono">
            {textPayload.length > 0 ? `${textPayload.length} chars` : 'Press Enter to send'}
          </span>

          <button
            type="button"
            onClick={handleSend}
            disabled={!textPayload.trim() || sendState === 'sending'}
            className={`py-3 px-8 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center space-x-2 cursor-pointer ${
              sendState === 'sent'
                ? 'bg-emerald-600 text-white font-bold'
                : sendState === 'failed'
                ? 'bg-red-600 text-white'
                : textPayload.trim() && sendState !== 'sending'
                ? 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
            }`}
          >
            <span>
              {sendState === 'sending'
                ? 'Sending…'
                : sendState === 'sent'
                ? 'Sent ✓'
                : sendState === 'failed'
                ? 'Not delivered'
                : 'SEND'}
            </span>
          </button>
        </div>
      </div>

      {/* File Upload Section (supports single and multiple files) */}
      <FileUploader onSendFile={(payload) => onSendMessage(payload)} />

      {/* Sent History */}
      {history.length > 0 && (
        <div className="w-full mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2 px-1">
            Recently Sent ({history.length})
          </h3>
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs"
              >
                <div className="font-mono text-neutral-600 dark:text-neutral-400 truncate max-w-[280px]">
                  {formatSnippetText(item.text)}
                </div>
                <span className="text-[10px] text-neutral-400 shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
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
