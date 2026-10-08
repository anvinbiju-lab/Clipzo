'use client';

import React, { useState, useEffect } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import type { SnippetItem } from '../types/protocol';
import { MessageRenderer, type FileItem } from './MessageRenderer';
import { formatSnippetText } from '../lib/utils';
import { triggerDownload, downloadAllFiles } from '../lib/download';

interface ReceiverViewProps {
  code: string | null;
  connected: boolean;
  peerConnected: boolean;
  reconnecting: boolean;
  error: string | null;
  expired: boolean;
  latestMessage: SnippetItem | null;
  history: SnippetItem[];
  initialCode?: string;
  onJoinRoom: (code: string) => void;
  onDisconnect: () => void;
  onClearMessage: () => void;
  onClearError: () => void;
}

export function ReceiverView({
  code,
  connected: _connected,
  peerConnected,
  reconnecting,
  error,
  expired,
  latestMessage,
  history,
  initialCode = '',
  onJoinRoom,
  onDisconnect,
  onClearMessage,
  onClearError,
}: ReceiverViewProps) {
  const [inputCode, setInputCode] = useState(initialCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) setInputCode(initialCode.toUpperCase().trim());
  }, [initialCode]);

  useEffect(() => {
    if (code || error) setIsSubmitting(false);
  }, [code, error]);

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean.length < 2) return;
    setIsSubmitting(true);
    onClearError();
    onJoinRoom(clean);
  };

  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    setCopyStatus(success ? 'Copied' : 'Failed');
    setTimeout(() => setCopyStatus(null), 2500);
  };

  const handleCopyAndClear = async (text: string) => {
    await handleCopy(text);
    setTimeout(() => onClearMessage(), 400);
  };

  const handleMainDownload = async () => {
    if (!latestMessage) return;
    const text = latestMessage.text;

    if (text.startsWith('FILES::')) {
      try {
        const files: FileItem[] = JSON.parse(text.substring('FILES::'.length));
        setDownloadStatus('Downloading…');
        await downloadAllFiles(files);
        setDownloadStatus('Done ✓');
        setTimeout(() => setDownloadStatus(null), 2000);
      } catch {
        setDownloadStatus('Error');
      }
    } else if (text.startsWith('FILE::')) {
      const parts = text.split('::');
      setDownloadStatus('Downloading…');
      await triggerDownload(parts[1], parts[2] || 'download');
      setDownloadStatus('Done ✓');
      setTimeout(() => setDownloadStatus(null), 2000);
    }
  };

  // Expired
  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 max-w-sm mx-auto animate-fade-in">
        <div className="card-elevated p-8 w-full text-center">
          <div className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--danger-subtle)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--danger)' }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Session ended</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>All session data has been cleared.</p>
          <button
            type="button"
            onClick={() => {
              onDisconnect();
              setInputCode('');
              setIsSubmitting(false);
            }}
            className="btn-primary w-full text-sm"
          >
            Join another
          </button>
        </div>
      </div>
    );
  }

  // Code entry screen
  if (!code) {
    return (
      <div className="flex flex-col items-center justify-center py-16 max-w-xs mx-auto animate-fade-in">
        <div className="card-elevated p-6 w-full">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--success-subtle)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}>
                <polyline points="8 17 12 21 16 17" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29" />
              </svg>
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Receive</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
              Enter the code shown on the sender&apos;s screen
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: 'var(--danger-subtle)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().trim();
                setInputCode(val);
                if (error) onClearError();
                if (val.length === 2 && !isSubmitting) {
                  setIsSubmitting(true);
                  onClearError();
                  onJoinRoom(val);
                }
              }}
              maxLength={4}
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="··"
              className="input-field text-center font-mono text-4xl font-bold tracking-[0.3em] py-4"
            />
            <button
              type="submit"
              disabled={inputCode.trim().length < 2 || isSubmitting}
              className="btn-primary w-full text-sm"
            >
              {isSubmitting ? 'Connecting…' : 'Connect'}
            </button>
          </form>

          <p className="text-[11px] text-center mt-5" style={{ color: 'var(--fg-faint)' }}>
            No signup needed
          </p>
        </div>
      </div>
    );
  }

  // Connected receiver view
  const isBatch = latestMessage?.text.startsWith('FILES::');
  const isSingleFile = latestMessage?.text.startsWith('FILE::');
  const isAnyFile = isBatch || isSingleFile;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {error && (
        <div className="p-3 rounded-lg text-sm font-medium" style={{ background: 'var(--danger-subtle)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Session bar */}
      <div className="card-elevated p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--fg)' }}>
              {code}
            </span>
            <div className="badge" style={{
              background: peerConnected ? 'var(--success-subtle)' : reconnecting ? 'rgba(245,158,11,0.1)' : 'var(--bg-tertiary)',
              color: peerConnected ? 'var(--success)' : reconnecting ? '#f59e0b' : 'var(--fg-muted)',
            }}>
              <span className={`status-dot ${peerConnected ? 'status-dot-success' : reconnecting ? 'status-dot-warning' : 'status-dot-idle'}`} />
              {reconnecting ? 'Reconnecting' : peerConnected ? 'Sender connected' : 'Waiting for sender'}
            </div>
          </div>
          <button
            type="button"
            onClick={onDisconnect}
            className="btn-ghost text-xs"
            style={{ color: 'var(--danger)' }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Received content */}
      {latestMessage ? (
        <div className="card-elevated p-5" style={{ borderColor: 'var(--success)', borderWidth: '1px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-success" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>New item received</span>
            </div>
            <span className="text-[11px] font-mono" style={{ color: 'var(--fg-faint)' }}>
              {new Date(latestMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className="rounded-lg p-4 overflow-x-auto max-h-[400px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <MessageRenderer text={latestMessage.text} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {isAnyFile && (
              <button type="button" onClick={handleMainDownload} className="btn-primary text-sm py-2.5 px-5" style={{ background: 'var(--success)' }}>
                {downloadStatus || (isBatch ? 'Download all' : 'Download')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const toCopy = latestMessage.text.startsWith('FILE::')
                  ? latestMessage.text.split('::')[1]
                  : latestMessage.text;
                handleCopy(toCopy);
              }}
              className={isAnyFile ? 'btn-secondary text-sm py-2.5 px-5' : 'btn-primary text-sm py-2.5 px-5'}
            >
              {copyStatus || (isAnyFile ? 'Copy link' : 'Copy to clipboard')}
            </button>
            <button
              type="button"
              onClick={() => handleCopyAndClear(latestMessage.text)}
              className="btn-ghost text-xs"
            >
              Copy & clear
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center" style={{ borderStyle: 'dashed' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--fg-faint)' }}>
            <polyline points="8 17 12 21 16 17" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
            Waiting for incoming content…
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-faint)' }}>
            It will appear here instantly when the sender drops it.
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <div className="label mb-2 px-1">History ({history.length})</div>
          <div className="space-y-2">
            {history.slice(1).map((item) => (
              <div key={item.id} className="card p-3 flex items-center justify-between gap-3">
                <span className="font-mono text-xs truncate" style={{ color: 'var(--fg-muted)' }}>
                  {formatSnippetText(item.text)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.text.startsWith('FILE::') && (
                    <button
                      type="button"
                      onClick={() => {
                        const parts = item.text.split('::');
                        triggerDownload(parts[1], parts[2] || 'download');
                      }}
                      className="btn-ghost text-[11px] px-2 py-1"
                    >
                      Download
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const toCopy = item.text.startsWith('FILE::') ? item.text.split('::')[1] : item.text;
                      const ok = await copyToClipboard(toCopy);
                      if (ok) {
                        setCopiedHistoryId(item.id);
                        setTimeout(() => setCopiedHistoryId(null), 2000);
                      }
                    }}
                    className="btn-ghost text-[11px] px-2 py-1"
                  >
                    {copiedHistoryId === item.id ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
