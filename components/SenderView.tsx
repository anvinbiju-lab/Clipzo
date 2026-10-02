'use client';

import React, { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { PRIVACY_STATEMENT, VALID_CODE_CHARS } from '../lib/constants';
import type { SnippetItem } from '../types/protocol';
import { FileUploader } from './FileUploader';
import { MessageRenderer } from './MessageRenderer';
import { formatSnippetText } from '../lib/utils';

interface SenderViewProps {
  code: string | null;
  connected: boolean;
  peerConnected: boolean;
  reconnecting: boolean;
  error: string | null;
  expired: boolean;
  history: SnippetItem[];
  latestMessage?: SnippetItem | null;
  initialCode?: string;
  onJoinRoom: (code: string) => void;
  onSendMessage: (text: string) => Promise<boolean>;
  onDisconnect: () => void;
  onClearError: () => void;
  onClearMessage?: () => void;
}

export function SenderView({
  code,
  connected,
  peerConnected,
  reconnecting,
  error,
  expired,
  history,
  latestMessage,
  initialCode = '',
  onJoinRoom,
  onSendMessage,
  onDisconnect,
  onClearError,
  onClearMessage,
}: SenderViewProps) {
  const [inputCode, setInputCode] = useState(initialCode);
  const [textPayload, setTextPayload] = useState('');
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus code input if not connected, or textarea if connected
  useEffect(() => {
    if (!code) {
      codeInputRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  }, [code]);

  // Clean and filter code input
  const sanitizeCode = (val: string) => {
    return val
      .toUpperCase()
      .split('')
      .filter((ch) => VALID_CODE_CHARS.includes(ch))
      .join('')
      .slice(0, 2);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onClearError();
    const sanitized = sanitizeCode(e.target.value);
    setInputCode(sanitized);
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.length === 2) {
      onJoinRoom(inputCode);
    }
  };

  const handleSend = async () => {
    if (!textPayload || sendState === 'sending') return;

    setSendState('sending');
    const success = await onSendMessage(textPayload);

    if (success) {
      setSendState('sent');
      setTextPayload('');
      // Immediately re-focus textarea for next snippet
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
    // Cmd+Enter or Ctrl+Enter to send quickly
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto my-10 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-xl mb-4">
          ⏱️
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Session Expired</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 mb-6">
          The temporary room closed due to inactivity.
        </p>
        <button
          type="button"
          onClick={() => {
            setInputCode('');
            onDisconnect();
          }}
          className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold rounded-xl text-sm transition-colors"
        >
          Enter New Code
        </button>
      </div>
    );
  }

  // Not yet connected to a room
  if (!code) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 flex flex-col items-center">
        {error && (
          <div className="w-full mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs sm:text-sm text-center font-medium">
            {error}
          </div>
        )}

        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 text-center shadow-xs">
          <h2 className="text-sm uppercase font-bold tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">
            Enter Room Code
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
            Enter the 2-character code shown on the receiver&apos;s screen.
          </p>

          <form onSubmit={handleConnectSubmit} className="space-y-5">
            <div className="flex justify-center">
              <input
                ref={codeInputRef}
                type="text"
                value={inputCode}
                onChange={handleCodeChange}
                placeholder="AB"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={2}
                className="w-56 text-center font-mono text-4xl sm:text-5xl font-black tracking-widest px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 rounded-2xl focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-hidden transition-all text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
              />
            </div>

            <button
              type="submit"
              disabled={inputCode.length !== 2}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-sm transition-colors ${
                inputCode.length === 2
                  ? 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
              }`}
            >
              CONNECT
            </button>
          </form>
        </div>

        <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500 text-center">
          {PRIVACY_STATEMENT}
        </p>
      </div>
    );
  }

  // Connected to room
  return (
    <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center">
      {error && (
        <div className="w-full mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs text-center font-medium">
          {error}
        </div>
      )}

      {/* Connection Header Bar */}
      <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 px-4 flex items-center justify-between mb-4 shadow-xs">
        <div className="flex items-center space-x-2">
          {reconnecting ? (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          )}
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {reconnecting ? 'Reconnecting…' : 'Connected to Receiver'}
          </span>
          <span className="font-mono font-bold text-xs bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-800 dark:text-neutral-200">
            {code}
          </span>
        </div>

        <button
          type="button"
          onClick={onDisconnect}
          className="text-xs text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Main Send Card */}
      <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
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
          placeholder="Paste code, URL, or notes here…"
          rows={5}
          className="w-full p-3.5 font-mono text-sm leading-relaxed bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-hidden text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 resize-y"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-neutral-400 font-mono">
            {textPayload.length > 0 ? `${textPayload.length} chars` : ''}
          </span>

          <button
            type="button"
            onClick={handleSend}
            disabled={!textPayload.trim() || sendState === 'sending'}
            className={`py-3 px-8 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center space-x-2 ${
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

      {/* File Upload — always visible regardless of device */}
      <div className="w-full">
        <FileUploader onSendFile={onSendMessage} />
      </div>

      {/* Received Text Card — sender can also receive */}
      {latestMessage && (
        <div className="w-full mt-6 bg-white dark:bg-neutral-900 border-2 border-neutral-900 dark:border-neutral-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Received
              </h2>
            </div>
            <span className="text-xs text-neutral-400 font-mono">
              {new Date(latestMessage.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 overflow-x-auto max-h-[380px]">
            <MessageRenderer text={latestMessage.text} />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={async () => {
                await copyToClipboard(latestMessage.text);
              }}
              className="flex-1 py-3 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-bold text-sm transition-colors"
            >
              COPY
            </button>
            {onClearMessage && (
              <button
                type="button"
                onClick={onClearMessage}
                className="py-3 px-5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
