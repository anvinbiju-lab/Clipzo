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
      <div className="flex flex-col items-center justify-center p-10 text-center max-w-md mx-auto my-12 glass-panel rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center text-3xl mb-5 shadow-inner">
          ⏱️
        </div>
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2 z-10">Session Expired</h2>
        <p className="text-base text-neutral-500 dark:text-neutral-400 mt-2 mb-8 font-medium z-10">
          This transfer session has expired and all session data was deleted.
        </p>
        <button
          type="button"
          onClick={() => {
            onDisconnect();
            setInputCode('');
            setIsSubmitting(false);
          }}
          className="w-full py-4 px-6 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-bold rounded-2xl shadow-lg transition-all text-base z-10"
        >
          Join Another Session
        </button>
      </div>
    );
  }

  // SCREEN 1: Code Entry Screen (when not yet joined to a room)
  if (!code) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 flex flex-col items-center">
        <div className="w-full glass-panel rounded-3xl p-8 sm:p-10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-emerald-500/20 rounded-full blur-[60px] pointer-events-none" />
          
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-3xl mb-4 shadow-inner relative z-10">
            📥
          </div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-1 relative z-10">
            Receive Files
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 font-medium relative z-10">
            Enter the 2-character code shown on the sender&apos;s screen.
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50/80 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold backdrop-blur-sm relative z-10">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-6 relative z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase().trim());
                  if (error) onClearError();
                }}
                maxLength={2}
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder=""
                className="relative w-full py-5 px-4 text-center font-mono text-5xl font-black tracking-[0.25em] bg-white/50 dark:bg-black/40 border border-neutral-200/50 dark:border-neutral-700/50 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-500 focus:outline-hidden text-neutral-900 dark:text-white uppercase placeholder:text-neutral-300 dark:placeholder:text-neutral-800 shadow-inner backdrop-blur-md transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={inputCode.trim().length < 2 || isSubmitting}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {isSubmitting ? 'CONNECTING…' : 'CONNECT'}
            </button>
          </form>

          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-8 font-medium relative z-10">
            No signup needed. Direct transfer to this device.
          </p>
        </div>

        <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500 text-center font-medium opacity-70">
          {PRIVACY_STATEMENT}
        </p>
      </div>
    );
  }

  // SCREEN 2: Connected Receiver View
  const isBatch = latestMessage?.text.startsWith('FILES::');
  const isSingleFile = latestMessage?.text.startsWith('FILE::');
  const isAnyFile = isBatch || isSingleFile;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center">
      {error && (
        <div className="w-full mb-6 p-4 rounded-2xl bg-red-50/80 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold text-center backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Connected Session Info Banner */}
      <div className="w-full glass-panel rounded-3xl p-5 sm:p-6 text-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-center justify-between pb-4 border-b border-neutral-200/50 dark:border-neutral-700/50 gap-4 relative z-10">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Session
            </span>
            <span className="font-mono text-lg font-black px-3 py-1 rounded-xl bg-black/5 dark:bg-white/10 text-neutral-900 dark:text-white shadow-inner">
              {code}
            </span>
          </div>

          <button
            type="button"
            onClick={onDisconnect}
            className="text-sm font-bold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-xl"
          >
            Leave Session
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center relative z-10">
          {reconnecting ? (
            <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 shadow-sm animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2" />
              Reconnecting…
            </span>
          ) : peerConnected ? (
            <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Sender Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200/50 dark:border-white/10 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2 animate-ping" />
              Waiting for sender…
            </span>
          )}
        </div>
      </div>

      {/* Received Item Card */}
      {latestMessage ? (
        <div className="w-full mt-6 glass-panel-heavy rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-emerald-500/30">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" />
              <h2 className="text-base font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                New Item Received
              </h2>
            </div>
            <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 font-mono bg-black/5 dark:bg-white/10 px-2 py-1 rounded-lg">
              {new Date(latestMessage.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="bg-white/60 dark:bg-black/40 border border-neutral-200/50 dark:border-neutral-700/50 rounded-2xl p-4 sm:p-6 overflow-x-auto max-h-[500px] shadow-inner relative z-10 backdrop-blur-md">
            <MessageRenderer text={latestMessage.text} />
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 relative z-10">
            {isAnyFile && (
              <button
                type="button"
                onClick={handleMainDownload}
                className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-base shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer transform hover:-translate-y-0.5"
              >
                <span>{downloadStatus || (isBatch ? '⬇️ Download All Files' : '⬇️ Download Direct')}</span>
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
              className={`py-4 px-6 rounded-2xl font-bold text-base shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer transform hover:-translate-y-0.5 ${
                isAnyFile
                  ? 'glass-panel hover:bg-white/80 dark:hover:bg-white/10 text-neutral-800 dark:text-white'
                  : 'flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25'
              }`}
            >
              <span>{copyStatus || (isAnyFile ? 'Copy Link' : 'COPY TEXT')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyAndClear(latestMessage.text)}
              className="py-4 px-6 rounded-2xl glass-panel hover:bg-white/80 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 font-bold text-sm transition-all cursor-pointer shadow-md"
            >
              Copy & Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full mt-8 glass-panel rounded-3xl p-12 text-center border-dashed border-2 border-neutral-300 dark:border-neutral-700/50">
          <div className="text-5xl mb-4 opacity-80">📥</div>
          <p className="text-xl font-black text-neutral-800 dark:text-white">
            Waiting for incoming items…
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3 max-w-sm mx-auto font-medium">
            When the sender drops a file or text, it will appear here instantly.
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="w-full mt-10">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4 px-2">
            History ({history.length})
          </h3>
          <div className="space-y-3">
            {history.slice(1).map((item) => (
              <div
                key={item.id}
                className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="font-mono text-sm text-neutral-700 dark:text-neutral-300 truncate w-full max-w-lg">
                  {formatSnippetText(item.text)}
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {item.text.startsWith('FILE::') && (
                    <button
                      type="button"
                      onClick={() => {
                        const parts = item.text.split('::');
                        triggerDownload(parts[1], parts[2] || 'download');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs transition-colors cursor-pointer border border-emerald-200/50 dark:border-emerald-500/20"
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
                    className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 font-bold text-xs transition-colors cursor-pointer border border-neutral-200/50 dark:border-neutral-700/50"
                  >
                    {copiedHistoryId === item.id ? 'Copied ✓' : (item.text.startsWith('FILE::') ? 'Copy Link' : 'Copy')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-12 text-xs font-medium text-neutral-400 dark:text-neutral-500 text-center opacity-70">
        {PRIVACY_STATEMENT}
      </p>
    </div>
  );
}
