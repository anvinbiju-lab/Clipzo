'use client';

import React, { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
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
  const [isResetting, setIsResetting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasRequestedRoom = useRef(false);
  useEffect(() => {
    if (!code && !expired && !hasRequestedRoom.current) {
      hasRequestedRoom.current = true;
      onCreateRoom('send');
    }
  }, [code, expired, onCreateRoom]);

  const handleEndSession = async () => {
    setIsResetting(true);
    hasRequestedRoom.current = false;
    setTextPayload('');
    onClearError();
    onDisconnect();
    setTimeout(() => {
      onCreateRoom('send');
      setIsResetting(false);
    }, 50);
  };

  useEffect(() => {
    if (code) {
      textareaRef.current?.focus();
    }
  }, [code]);

  const handleCopyCode = async () => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopyStatus('Copied');
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
      setTimeout(() => textareaRef.current?.focus(), 50);
      setTimeout(() => setSendState('idle'), 2500);
    } else {
      setSendState('failed');
      setTimeout(() => setSendState('idle'), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const joinUrl = typeof window !== 'undefined' && code ? `${window.location.origin}/j/${code}` : '';

  // Expired state
  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto animate-fade-in">
        <div className="card-elevated p-8 w-full">
          <div className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--danger-subtle)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--danger)' }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Session ended</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
            All session data has been cleared.
          </p>
          <button
            type="button"
            onClick={() => {
              hasRequestedRoom.current = false;
              onCreateRoom('send');
            }}
            className="btn-primary w-full text-sm"
          >
            New session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg text-sm font-medium flex items-center justify-between gap-3" style={{ background: 'var(--danger-subtle)', color: 'var(--danger)' }}>
          <span>{error}</span>
          {!code && (
            <button
              type="button"
              onClick={() => {
                hasRequestedRoom.current = false;
                onClearError();
                onCreateRoom('send');
              }}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Code + Status Row */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Code display */}
          <div className="flex items-center gap-4">
            <div>
              <div className="label mb-1">Room code</div>
              <button
                type="button"
                onClick={handleCopyCode}
                disabled={!code || isResetting}
                className="font-mono text-3xl font-bold tracking-widest cursor-pointer transition-colors hover:opacity-70 flex items-center min-h-[36px]"
                style={{ color: 'var(--accent)' }}
                title="Click to copy"
              >
                {isResetting ? (
                  <span className="text-sm font-sans tracking-normal opacity-70">New session…</span>
                ) : (
                  code || <span className="opacity-40 animate-pulse">··</span>
                )}
              </button>
              {copyStatus && (
                <span className="ml-2 text-xs font-medium animate-fade-in" style={{ color: 'var(--success)' }}>
                  {copyStatus}
                </span>
              )}
            </div>
          </div>

          {/* Status + Actions */}
          <div className="flex items-center gap-3">
            <div className="badge" style={{
              background: peerConnected ? 'var(--success-subtle)' : reconnecting ? 'rgba(245,158,11,0.1)' : 'var(--bg-tertiary)',
              color: peerConnected ? 'var(--success)' : reconnecting ? '#f59e0b' : 'var(--fg-muted)',
            }}>
              <span className={`status-dot ${peerConnected ? 'status-dot-success' : reconnecting ? 'status-dot-warning' : 'status-dot-idle'}`} />
              {reconnecting ? 'Reconnecting' : peerConnected ? 'Connected' : 'Waiting'}
            </div>
            <button type="button" onClick={() => setShowQr(true)} className="btn-ghost text-xs px-2 py-1.5" title="Show QR">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="8" height="8" rx="1" />
                <rect x="14" y="2" width="8" height="8" rx="1" />
                <rect x="2" y="14" width="8" height="8" rx="1" />
                <rect x="14" y="14" width="4" height="4" />
                <line x1="22" y1="14" x2="22" y2="14.01" />
                <line x1="22" y1="22" x2="22" y2="22.01" />
                <line x1="18" y1="18" x2="18" y2="18.01" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleEndSession}
              disabled={isResetting}
              className="btn-ghost text-xs px-2.5 py-1.5 font-medium transition-all cursor-pointer"
              style={{ color: 'var(--danger)' }}
              title="End current session and start a new one"
            >
              {isResetting ? 'Ending…' : 'End session'}
            </button>
          </div>
        </div>
      </div>

      {/* Text input */}
      <div className="card-elevated p-5">
        <label htmlFor="drop-textarea" className="label mb-2 block">
          Paste text or code
        </label>
        <textarea
          id="drop-textarea"
          ref={textareaRef}
          value={textPayload}
          onChange={(e) => setTextPayload(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste your code or program here… (Ctrl+Enter to send)"
          rows={6}
          className="input-field font-mono text-sm leading-relaxed resize-y"
          style={{ minHeight: '120px' }}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs font-mono" style={{ color: 'var(--fg-faint)' }}>
            {textPayload.length > 0 ? `${textPayload.length} chars · Ctrl+Enter to send` : 'Ctrl+Enter or Send button to drop'}
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!textPayload.trim() || sendState === 'sending'}
            className="btn-primary text-sm py-2.5 px-6"
            style={
              sendState === 'sent'
                ? { background: 'var(--success)' }
                : sendState === 'failed'
                ? { background: 'var(--danger)' }
                : {}
            }
          >
            {sendState === 'sending' ? 'Sending…' : sendState === 'sent' ? 'Sent ✓' : sendState === 'failed' ? 'Failed' : 'Send'}
          </button>
        </div>
      </div>

      {/* File uploader */}
      <FileUploader onSendFile={(payload) => onSendMessage(payload)} />

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="label mb-2 px-1">Sent ({history.length})</div>
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="card p-3 flex items-center justify-between text-sm"
              >
                <span className="font-mono text-xs truncate max-w-[70%]" style={{ color: 'var(--fg-muted)' }}>
                  {formatSnippetText(item.text)}
                </span>
                <span className="text-[11px] font-mono" style={{ color: 'var(--fg-faint)' }}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
