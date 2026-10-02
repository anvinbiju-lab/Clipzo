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

  const hasRequestedRoom = useRef(false);
  useEffect(() => {
    if (!code && !expired && !hasRequestedRoom.current) {
      hasRequestedRoom.current = true;
      onCreateRoom('send');
    }
  }, [code, expired, onCreateRoom]);

  useEffect(() => {
    if (code) {
      textareaRef.current?.focus();
    }
  }, [code]);

  const handleCopyCode = async () => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopyStatus('Copied ✓');
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const joinUrl = typeof window !== 'undefined' && code ? `${window.location.origin}/j/${code}` : '';

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center max-w-md mx-auto my-12 glass-panel rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center text-3xl mb-5 shadow-inner">
          ⏱️
        </div>
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2 z-10">Session Expired</h2>
        <p className="text-base text-neutral-500 dark:text-neutral-400 mt-2 mb-8 font-medium z-10">
          This temporary session has expired and all session data was deleted.
        </p>
        <button
          type="button"
          onClick={() => {
            hasRequestedRoom.current = false;
            onCreateRoom('send');
          }}
          className="w-full py-4 px-6 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-bold rounded-2xl shadow-lg transition-all text-base z-10"
        >
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center">
      {error && (
        <div className="w-full mb-6 p-4 rounded-2xl bg-red-50/80 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold text-center backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Code Sharing Card */}
      <div className="w-full glass-panel-heavy rounded-3xl p-8 sm:p-12 flex flex-col items-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] pointer-events-none" />

        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-3 z-10">
          Your Pairing Code
        </span>

        <div className="relative group cursor-pointer z-10" onClick={handleCopyCode} title="Click to copy code">
          <div className="font-mono text-7xl sm:text-8xl font-black tracking-[0.1em] text-neutral-900 dark:text-white my-3 select-all transition-transform group-hover:scale-105 drop-shadow-xl text-gradient">
            {code || '··'}
          </div>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-blue-50 dark:bg-blue-500/20 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-500/30">
            {copyStatus || 'Click to copy code'}
          </span>
        </div>

        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mt-8 max-w-sm text-center z-10">
          Type this code on the receiving device at{' '}
          <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md">
            {typeof window !== 'undefined' ? window.location.host : 'quickdrop.com'}
          </span>
        </p>

        {/* Peer Status Badge */}
        <div className="mt-8 flex items-center space-x-3 text-sm font-bold px-5 py-2.5 rounded-2xl bg-white/50 dark:bg-black/30 backdrop-blur-sm border border-neutral-200/50 dark:border-white/10 shadow-sm z-10">
          <span
            className={`w-3 h-3 rounded-full shadow-inner ${
              reconnecting
                ? 'bg-amber-500 animate-pulse'
                : peerConnected
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : 'bg-neutral-400 dark:bg-neutral-600'
            }`}
          />
          <span className="text-neutral-700 dark:text-neutral-200">
            {reconnecting
              ? 'Reconnecting…'
              : peerConnected
              ? 'Receiver Connected'
              : 'Waiting for receiver…'}
          </span>
        </div>

        {/* Secondary Actions */}
        <div className="mt-8 pt-6 border-t border-neutral-200/50 dark:border-neutral-700/50 w-full flex items-center justify-center space-x-8 text-sm font-bold text-neutral-500 z-10">
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center space-x-2 cursor-pointer"
          >
            <span className="text-lg">📱</span>
            <span>Show QR code</span>
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <button
            type="button"
            onClick={onDisconnect}
            className="hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Main Send Text Card */}
      <div className="w-full mt-8 glass-panel rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <label
          htmlFor="drop-textarea"
          className="block text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3"
        >
          Paste text / code
        </label>

        <div className="relative group">
          <div className="absolute inset-0 bg-blue-500/10 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <textarea
            id="drop-textarea"
            ref={textareaRef}
            value={textPayload}
            onChange={(e) => setTextPayload(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste code, URL, or notes here… (Press Enter to send)"
            rows={5}
            className="relative w-full p-5 font-mono text-base leading-relaxed bg-white/60 dark:bg-black/40 border border-neutral-200/50 dark:border-neutral-700/50 rounded-2xl focus:border-blue-500 dark:focus:border-blue-500 focus:outline-hidden text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 resize-y shadow-inner backdrop-blur-md transition-all"
          />
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-bold text-neutral-400 font-mono bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-lg">
            {textPayload.length > 0 ? `${textPayload.length} characters` : 'Shift+Enter for new line'}
          </span>

          <button
            type="button"
            onClick={handleSend}
            disabled={!textPayload.trim() || sendState === 'sending'}
            className={`w-full sm:w-auto py-3.5 px-10 rounded-2xl font-bold text-base shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer transform hover:-translate-y-0.5 ${
              sendState === 'sent'
                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                : sendState === 'failed'
                ? 'bg-red-500 text-white shadow-red-500/30'
                : textPayload.trim() && sendState !== 'sending'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30'
                : 'glass-panel text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-70'
            }`}
          >
            <span>
              {sendState === 'sending'
                ? 'SENDING…'
                : sendState === 'sent'
                ? 'SENT ✓'
                : sendState === 'failed'
                ? 'FAILED'
                : 'SEND NOW'}
            </span>
          </button>
        </div>
      </div>

      <FileUploader onSendFile={(payload) => onSendMessage(payload)} />

      {/* Sent History */}
      {history.length > 0 && (
        <div className="w-full mt-10">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4 px-2">
            Recently Sent ({history.length})
          </h3>
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="glass-panel rounded-2xl p-4 flex items-center justify-between text-sm shadow-sm"
              >
                <div className="font-mono font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[70%]">
                  {formatSnippetText(item.text)}
                </div>
                <span className="text-xs font-bold text-neutral-400 shrink-0 bg-black/5 dark:bg-white/10 px-2 py-1 rounded-lg">
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

      <p className="mt-12 text-xs font-medium text-neutral-400 dark:text-neutral-500 text-center opacity-70">
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
