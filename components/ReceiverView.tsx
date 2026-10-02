'use client';

import React, { useState, useEffect } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { PRIVACY_STATEMENT } from '../lib/constants';
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
    if (initialCode) {
      setInputCode(initialCode.toUpperCase().trim());
    }
  }, [initialCode]);

  useEffect(() => {
    if (code) {
      setIsSubmitting(false);
    }
  }, [code]);

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
    if (success) {
      setCopyStatus('Copied ✓');
      setTimeout(() => setCopyStatus(null), 2500);
    } else {
      setCopyStatus('Unable to copy');
      setTimeout(() => setCopyStatus(null), 2500);
    }
  };

  const handleCopyAndClear = async (text: string) => {
    await handleCopy(text);
    setTimeout(() => {
      onClearMessage();
    }, 400);
  };

  const handleMainDownload = async () => {
    if (!latestMessage) return;
    const text = latestMessage.text;

    if (text.startsWith('FILES::')) {
      try {
        const files: FileItem[] = JSON.parse(text.substring('FILES::'.length));
        setDownloadStatus('Downloading…');
        await downloadAllFiles(files);
        setDownloadStatus('Downloaded ✓');
        setTimeout(() => setDownloadStatus(null), 2000);
      } catch {
        setDownloadStatus('Error');
      }
    } else if (text.startsWith('FILE::')) {
      const parts = text.split('::');
      const url = parts[1];
      const name = parts[2] || 'download';
      setDownloadStatus('Downloading…');
      await triggerDownload(url, name);
      setDownloadStatus('Downloaded ✓');
      setTimeout(() => setDownloadStatus(null), 2000);
    }
  };

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-12 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-xl mb-4">
          ⏱️
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Session Expired</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 mb-6">
          This transfer session has expired and all session data was deleted.
        </p>
        <button
          type="button"
          onClick={() => {
            onDisconnect();
            setInputCode('');
            setIsSubmitting(false);
          }}
          className="w-full py-3 px-6 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold rounded-xl shadow-sm transition-colors text-sm"
        >
          Join Another Session
        </button>
      </div>
    );
  }

  // SCREEN 1: Code Entry Screen (when not yet joined to a room)
  if (!code) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center">
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 text-center shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-2xl mb-3">
            📥
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
            Receive Files & Text
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
            Enter the 2 to 4-character code shown on the sender&apos;s screen.
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase().trim());
                  if (error) onClearError();
                }}
                maxLength={6}
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. 5D"
                className="w-full py-3.5 px-4 text-center font-mono text-3xl font-black tracking-widest bg-neutral-50 dark:bg-neutral-950 border-2 border-neutral-200 dark:border-neutral-800 rounded-xl focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-hidden text-neutral-900 dark:text-neutral-100 uppercase placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              />
            </div>

            <button
              type="submit"
              disabled={inputCode.trim().length < 2 || isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-bold text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'CONNECTING…' : 'CONNECT & RECEIVE'}
            </button>
          </form>

          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-6">
            No signup needed. Files and text transfer directly to this device.
          </p>
        </div>

        <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500 text-center">
          {PRIVACY_STATEMENT}
        </p>
      </div>
    );
  }

  // SCREEN 2: Connected Receiver View (waiting or displaying received items)
  const isBatch = latestMessage?.text.startsWith('FILES::');
  const isSingleFile = latestMessage?.text.startsWith('FILE::');
  const isAnyFile = isBatch || isSingleFile;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center">
      {error && (
        <div className="w-full mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm text-center font-medium">
          {error}
        </div>
      )}

      {/* Connected Session Info Banner */}
      <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 text-center shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
              Receiver Session
            </span>
            <span className="font-mono text-base font-black px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
              {code}
            </span>
          </div>

          <button
            type="button"
            onClick={onDisconnect}
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
          >
            Leave Session
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center space-x-2">
          {reconnecting ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
              Reconnecting…
            </span>
          ) : peerConnected ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
              Sender Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-ping" />
              Connected to room • Waiting for sender…
            </span>
          )}
        </div>
      </div>

      {/* Received Item Card */}
      {latestMessage ? (
        <div className="w-full mt-6 bg-white dark:bg-neutral-900 border-2 border-neutral-900 dark:border-neutral-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                New Received Item
              </h2>
            </div>
            <span className="text-xs text-neutral-400 font-mono">
              {new Date(latestMessage.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 overflow-x-auto max-h-[420px]">
            <MessageRenderer text={latestMessage.text} />
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {isAnyFile && (
              <button
                type="button"
                onClick={handleMainDownload}
                className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>{downloadStatus || (isBatch ? '⬇️ Download All' : '⬇️ Download Directly')}</span>
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
              className={`py-3.5 px-6 rounded-xl font-bold text-sm shadow-sm transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
                isAnyFile
                  ? 'border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                  : 'flex-1 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 text-base'
              }`}
            >
              <span>{copyStatus || (isAnyFile ? 'Copy Link' : 'COPY TEXT')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyAndClear(latestMessage.text)}
              className="py-3.5 px-5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-sm transition-colors cursor-pointer"
            >
              Copy & Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full mt-6 bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">📥</div>
          <p className="text-base font-bold text-neutral-800 dark:text-neutral-200">
            Waiting for incoming text or files…
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
            Connected to room <strong className="font-mono text-neutral-900 dark:text-neutral-100">{code}</strong>. When the sender sends an item, it will appear here instantly.
          </p>
        </div>
      )}

      {/* History (Recent Snippets) */}
      {history.length > 1 && (
        <div className="w-full mt-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3 px-1">
            Recent Received Items ({history.length})
          </h3>
          <div className="space-y-2">
            {history.slice(1).map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-[380px]">
                  {formatSnippetText(item.text)}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.text.startsWith('FILE::') && (
                    <button
                      type="button"
                      onClick={() => {
                        const parts = item.text.split('::');
                        triggerDownload(parts[1], parts[2] || 'download');
                      }}
                      className="px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      Download
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const toCopy = item.text.startsWith('FILE::')
                        ? item.text.split('::')[1]
                        : item.text;
                      const ok = await copyToClipboard(toCopy);
                      if (ok) {
                        setCopiedHistoryId(item.id);
                        setTimeout(() => setCopiedHistoryId(null), 2000);
                      }
                    }}
                    className="px-3 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium transition-colors cursor-pointer"
                  >
                    {copiedHistoryId === item.id ? 'Copied ✓' : (item.text.startsWith('FILE::') ? 'Copy Link' : 'Copy')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500 text-center">
        {PRIVACY_STATEMENT}
      </p>
    </div>
  );
}
