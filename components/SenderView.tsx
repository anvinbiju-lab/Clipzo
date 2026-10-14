'use client';

import React, { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import type { SnippetItem, Role, LabProgramItem } from '../types/protocol';
import { PROGRAMS_PREFIX } from '../types/protocol';
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
  latestMessage?: SnippetItem | null;
  history: SnippetItem[];
  onCreateRoom: (role?: Role) => void;
  onJoinRoom?: (code: string) => void;
  onSendMessage: (text: string) => Promise<boolean>;
  onDisconnect: () => void;
  onDestroySession?: () => void;
  onClearError: () => void;
}

export function SenderView({
  code,
  connected: _connected,
  peerConnected,
  reconnecting,
  error,
  expired,
  latestMessage,
  history,
  onCreateRoom,
  onJoinRoom,
  onSendMessage,
  onDisconnect,
  onDestroySession: _onDestroySession,
  onClearError,
}: SenderViewProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [textPayload, setTextPayload] = useState('');
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [isResetting, setIsResetting] = useState(false);
  const [showManageRoomInput, setShowManageRoomInput] = useState(false);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [recentRoomCode, setRecentRoomCode] = useState<string | null>(null);
  const [hasLoadedExisting, setHasLoadedExisting] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [mode, setMode] = useState<'single' | 'lab'>('single');
  const [labPrograms, setLabPrograms] = useState<LabProgramItem[]>([
    { id: '1', name: '01_program.c', code: '', lang: 'c' },
  ]);
  const [activeLabIndex, setActiveLabIndex] = useState(0);
  const [labSendState, setLabSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Read saved room from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipzo_last_sender_room');
      if (saved && saved.length >= 2) {
        setRecentRoomCode(saved.toUpperCase());
      }
    }
  }, []);

  // Persist room code whenever established
  useEffect(() => {
    if (code && typeof window !== 'undefined') {
      localStorage.setItem('clipzo_last_sender_room', code);
      setRecentRoomCode(code);
    }
  }, [code]);

  // Request initial room only if no code is active and user didn't request a specific room
  const hasRequestedRoom = useRef(false);
  useEffect(() => {
    if (!code && !expired && !hasRequestedRoom.current && !showManageRoomInput) {
      hasRequestedRoom.current = true;
      onCreateRoom('send');
    }
  }, [code, expired, onCreateRoom, showManageRoomInput]);

  // Load existing programs if the room contains them on initial room join/creation
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (latestMessage && latestMessage.text.startsWith(PROGRAMS_PREFIX)) {
      try {
        const loaded: LabProgramItem[] = JSON.parse(latestMessage.text.substring(PROGRAMS_PREFIX.length));
        if (Array.isArray(loaded) && loaded.length > 0) {
          // Only automatically load if this is initial mount or explicitly requested to load
          if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            setLabPrograms(loaded);
            setMode('lab');
            setActiveLabIndex(0);
            setHasLoadedExisting(true);
          }
        }
      } catch (err) {
        console.error('Failed parsing loaded programs', err);
      }
    }
  }, [latestMessage]);

  const handleEndSession = async () => {
    setIsResetting(true);
    hasRequestedRoom.current = false;
    isInitialLoadRef.current = true;
    setTextPayload('');
    setLabPrograms([{ id: '1', name: '01_program.c', code: '', lang: 'c' }]);
    setActiveLabIndex(0);
    setHasLoadedExisting(false);
    setSaveBanner(null);
    onClearError();
    onDisconnect();
    setTimeout(() => {
      onCreateRoom('send');
      setIsResetting(false);
    }, 50);
  };

  useEffect(() => {
    if (code && mode === 'single') {
      textareaRef.current?.focus();
    }
  }, [code, mode]);

  const handleCopyCode = async () => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopyStatus('Copied');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const handleJoinExisting = (targetCode: string) => {
    const clean = targetCode.trim().toUpperCase();
    if (clean.length < 2 || !onJoinRoom) return;
    onClearError();
    setShowManageRoomInput(false);
    isInitialLoadRef.current = true;
    onJoinRoom(clean);
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

  const handleAddProgram = () => {
    if (labPrograms.length >= 20) return;
    const newIdx = labPrograms.length + 1;
    const numPrefix = newIdx < 10 ? `0${newIdx}` : `${newIdx}`;
    const id = Math.random().toString(36).substring(2, 7);
    const prevLang = labPrograms[activeLabIndex]?.lang || 'c';
    const newProg: LabProgramItem = {
      id,
      name: `${numPrefix}_program.${prevLang}`,
      code: '',
      lang: prevLang,
    };
    setLabPrograms((prev) => {
      const next = [...prev, newProg];
      setActiveLabIndex(next.length - 1);
      return next;
    });
  };

  const handleRemoveProgram = (index: number) => {
    if (labPrograms.length <= 1) {
      // Clear the single file instead of deleting the array
      setLabPrograms([{ id: '1', name: '01_program.c', code: '', lang: 'c' }]);
      setActiveLabIndex(0);
      return;
    }
    const updated = labPrograms.filter((_, idx) => idx !== index);
    setLabPrograms(updated);
    if (activeLabIndex >= updated.length) {
      setActiveLabIndex(Math.max(0, updated.length - 1));
    }
  };

  const updateActiveProgram = (field: keyof LabProgramItem, value: string) => {
    setLabPrograms((prev) => {
      const copy = [...prev];
      if (copy[activeLabIndex]) {
        copy[activeLabIndex] = { ...copy[activeLabIndex], [field]: value };
        if (field === 'name') {
          const ext = value.split('.').pop()?.toLowerCase();
          if (ext && ['c', 'cpp', 'java', 'py', 'sql', 'js', 'ts', 'sh', 'html', 'css', 'txt'].includes(ext)) {
            copy[activeLabIndex].lang = ext;
          }
        }
      }
      return copy;
    });
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imported: LabProgramItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
        imported.push({
          id: Math.random().toString(36).substring(2, 7),
          name: file.name,
          code: text,
          lang: ext,
        });
      } catch (err) {
        console.error('Failed reading file', file.name, err);
      }
    }

    if (imported.length > 0) {
      setLabPrograms((prev) => {
        if (prev.length === 1 && !prev[0].code.trim()) {
          return imported;
        }
        return [...prev, ...imported];
      });
      setActiveLabIndex(0);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save all valid files currently entered
  const handleSendLabPrograms = async () => {
    const valid = labPrograms.filter((p) => p.code.trim().length > 0);
    if (valid.length === 0 || labSendState === 'sending') return;

    setLabSendState('sending');
    const payload = PROGRAMS_PREFIX + JSON.stringify(valid);
    const success = await onSendMessage(payload);

    if (success) {
      setLabSendState('sent');
      setHasLoadedExisting(true);
      setSaveBanner(`${valid.length} file(s) saved to room ${code || ''}`);
      setTimeout(() => setLabSendState('idle'), 2500);
    } else {
      setLabSendState('failed');
      setTimeout(() => setLabSendState('idle'), 3000);
    }
  };

  // Save current file and immediately prepare the next file slot
  const handleSaveAndAddNext = async () => {
    const current = labPrograms[activeLabIndex];
    if (!current || !current.code.trim()) {
      alert('Please enter some code for the current file before adding another.');
      return;
    }

    const valid = labPrograms.filter((p) => p.code.trim().length > 0);
    if (valid.length === 0 || labSendState === 'sending') return;

    setLabSendState('sending');
    const payload = PROGRAMS_PREFIX + JSON.stringify(valid);
    const success = await onSendMessage(payload);

    if (success) {
      setLabSendState('sent');
      setHasLoadedExisting(true);

      // Create next file slot and advance to it
      const nextIdx = labPrograms.length + 1;
      const numPrefix = nextIdx < 10 ? `0${nextIdx}` : `${nextIdx}`;
      const id = Math.random().toString(36).substring(2, 7);
      const prevLang = current.lang || 'c';
      const newProg: LabProgramItem = {
        id,
        name: `${numPrefix}_program.${prevLang}`,
        code: '',
        lang: prevLang,
      };

      setLabPrograms((prev) => {
        const nextList = [...prev, newProg];
        setActiveLabIndex(nextList.length - 1);
        return nextList;
      });

      setSaveBanner(`File ${valid.length} saved! Now entering File ${nextIdx}.`);
      setTimeout(() => setLabSendState('idle'), 2500);
    } else {
      setLabSendState('failed');
      setTimeout(() => setLabSendState('idle'), 3000);
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

  const validFilesCount = labPrograms.filter((p) => p.code.trim().length > 0).length;

  return (
    <div className="flex flex-col gap-4 animate-fade-in w-full">
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
              <div className="flex items-center gap-2 mb-1">
                <span className="label">Room code</span>
                {/* "Manage existing room" ONLY appears when Multiple Files mode is selected */}
                {mode === 'lab' && onJoinRoom && !showManageRoomInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputRoomCode('');
                      setShowManageRoomInput(true);
                    }}
                    className="text-[11px] font-medium underline text-neutral-400 hover:text-neutral-200 cursor-pointer transition-colors ml-1"
                    title="Manage an existing room by entering its 2-character code"
                  >
                    Manage existing room
                  </button>
                )}
              </div>

              {mode === 'lab' && showManageRoomInput ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleJoinExisting(inputRoomCode);
                  }}
                  className="flex items-center gap-2 mt-1 animate-fade-in"
                >
                  <input
                    type="text"
                    maxLength={2}
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                    placeholder="··"
                    autoFocus
                    className="input-field text-center font-mono text-base font-bold py-1 px-2.5 w-16"
                  />
                  <button
                    type="submit"
                    disabled={inputRoomCode.trim().length < 2}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    Open Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManageRoomInput(false)}
                    className="btn-ghost text-xs py-1.5 px-2"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    disabled={!code || isResetting}
                    className="font-mono text-3xl font-bold tracking-widest cursor-pointer transition-colors hover:opacity-70 flex items-center min-h-[36px]"
                    style={{ color: 'var(--accent)' }}
                    title="Click to copy room code"
                  >
                    {isResetting ? (
                      <span className="text-sm font-sans tracking-normal opacity-70">New session…</span>
                    ) : (
                      code || <span className="opacity-40 animate-pulse">··</span>
                    )}
                  </button>
                  {copyStatus && (
                    <span className="text-xs font-medium animate-fade-in" style={{ color: 'var(--success)' }}>
                      {copyStatus}
                    </span>
                  )}
                  {/* Recent room chip only appears in Multiple Files mode */}
                  {mode === 'lab' && recentRoomCode && recentRoomCode !== code && onJoinRoom && (
                    <button
                      type="button"
                      onClick={() => handleJoinExisting(recentRoomCode)}
                      className="badge text-[11px] px-2 py-0.5 hover:opacity-80 transition-opacity cursor-pointer font-mono"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                      title={`Reopen recent room ${recentRoomCode} to edit or add files`}
                    >
                      Recent: {recentRoomCode}
                    </button>
                  )}
                </div>
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
              {isResetting ? 'Ending…' : 'New session'}
            </button>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 p-1 rounded-lg border border-neutral-800 bg-neutral-900/60">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              mode === 'single'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Single Item
          </button>
          <button
            type="button"
            onClick={() => setMode('lab')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              mode === 'lab'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Multiple Files
          </button>
        </div>
      </div>

      {mode === 'single' ? (
        <>
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
              placeholder="Paste text or code here… (Ctrl+Enter to send)"
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
        </>
      ) : (
        /* Multi-File Code Stager / Manager */
        <div className="card-elevated p-5 flex flex-col gap-4" style={{ borderColor: 'var(--accent)', borderWidth: '1px' }}>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-800">
            <div>
              <div className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <span>Code Files</span>
                <span className="badge text-[11px] px-2 py-0.5" style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}>
                  {validFilesCount} of {labPrograms.length} {labPrograms.length === 1 ? 'File' : 'Files'} Ready
                </span>
                {hasLoadedExisting && (
                  <span className="badge text-[10px] px-2 py-0.2 opacity-80" style={{ background: 'var(--bg-tertiary)', color: 'var(--fg-muted)' }}>
                    Saved in room
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Type each program and save. Receiver can view and copy each file from code <span className="font-mono font-bold text-neutral-200">{code}</span>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".c,.cpp,.h,.java,.py,.sql,.txt,.sh,.js,.ts,*"
                onChange={handleImportFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="Import local files"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Import Files</span>
              </button>
              <button
                type="button"
                onClick={handleAddProgram}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                title="Add new file"
              >
                <span>+ Add File</span>
              </button>
            </div>
          </div>

          {/* Save notification banner */}
          {saveBanner && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-400 animate-fade-in">
              <span className="font-medium flex items-center gap-1.5">
                <span>✓</span>
                <span>{saveBanner}</span>
              </span>
              <button
                type="button"
                onClick={() => setSaveBanner(null)}
                className="text-neutral-400 hover:text-neutral-200 font-bold px-1"
              >
                ×
              </button>
            </div>
          )}

          {/* Quick File Select Dropdown & Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative w-full sm:max-w-xs">
              <select
                value={activeLabIndex}
                onChange={(e) => setActiveLabIndex(Number(e.target.value))}
                className="w-full input-field font-mono text-xs py-1.5 pl-2.5 pr-8 bg-neutral-900 border-neutral-700 rounded-md font-medium text-neutral-200"
              >
                {labPrograms.map((p, idx) => (
                  <option key={p.id || idx} value={idx}>
                    {idx + 1}. {p.name || `File ${idx + 1}`} ({p.lang?.toUpperCase() || 'TXT'}) {p.code.trim() ? '✓' : '(empty)'}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <span className="text-[11px] font-mono text-neutral-400 self-end sm:self-center">
              Editing #{activeLabIndex + 1} of {labPrograms.length}
            </span>
          </div>

          {/* Program Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {labPrograms.map((p, idx) => {
              const isActive = idx === activeLabIndex;
              const hasCode = p.code.trim().length > 0;
              return (
                <div
                  key={p.id || idx}
                  onClick={() => setActiveLabIndex(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer transition-all border text-xs whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-indigo-500 bg-neutral-900 text-neutral-100 font-semibold'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span className="font-mono text-[11px] opacity-60">#{idx + 1}</span>
                  <span className="font-mono truncate max-w-[120px]">{p.name || `File ${idx + 1}`}</span>
                  {hasCode && <span className="text-emerald-400 text-[10px]">✓</span>}
                  {labPrograms.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProgram(idx);
                      }}
                      className="ml-1 text-neutral-500 hover:text-red-400 text-xs leading-none"
                      title="Delete file"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddProgram}
              className="text-xs px-2.5 py-1.5 rounded-md border border-dashed border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors whitespace-nowrap shrink-0"
              title="Add another file slot"
            >
              + Add File
            </button>
          </div>

          {/* Active Program Editor */}
          {labPrograms[activeLabIndex] && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-neutral-400 mb-1 block">
                    File Name
                  </label>
                  <input
                    type="text"
                    value={labPrograms[activeLabIndex].name}
                    onChange={(e) => updateActiveProgram('name', e.target.value)}
                    placeholder="e.g. main.c or solution.py"
                    className="input-field text-xs font-mono py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-1 block">
                    Language
                  </label>
                  <select
                    value={labPrograms[activeLabIndex].lang || 'c'}
                    onChange={(e) => updateActiveProgram('lang', e.target.value)}
                    className="input-field text-xs font-mono py-2 bg-neutral-900"
                  >
                    <option value="c">C (.c)</option>
                    <option value="cpp">C++ (.cpp)</option>
                    <option value="java">Java (.java)</option>
                    <option value="py">Python (.py)</option>
                    <option value="sql">SQL (.sql)</option>
                    <option value="sh">Shell (.sh)</option>
                    <option value="js">JavaScript (.js)</option>
                    <option value="ts">TypeScript (.ts)</option>
                    <option value="txt">Plain Text (.txt)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-400">
                    File Content
                  </label>
                  <span className="text-[11px] font-mono text-neutral-500">
                    {labPrograms[activeLabIndex].code.split('\n').length} lines · {labPrograms[activeLabIndex].code.length} chars
                  </span>
                </div>
                <textarea
                  value={labPrograms[activeLabIndex].code}
                  onChange={(e) => updateActiveProgram('code', e.target.value)}
                  placeholder="Paste or type program code here…"
                  rows={8}
                  className="input-field font-mono text-xs leading-relaxed resize-y"
                  style={{ minHeight: '160px' }}
                />
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="mt-2 pt-3 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-400">
                {validFilesCount} of {labPrograms.length} file(s) ready
              </span>
              {labPrograms.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveProgram(activeLabIndex)}
                  className="text-xs text-red-400 hover:underline cursor-pointer ml-2"
                  title="Delete current file"
                >
                  Delete this file
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Primary workflow: Save current file and add next file */}
              <button
                type="button"
                onClick={handleSaveAndAddNext}
                disabled={
                  !labPrograms[activeLabIndex]?.code.trim() ||
                  labSendState === 'sending'
                }
                className="btn-primary text-xs py-2 px-4 font-semibold flex items-center gap-1.5"
                title="Save this file and open a new empty file slot for the next program"
              >
                <span>+</span>
                <span>Save & Add Next File</span>
              </button>

              {/* Save / Update all files */}
              <button
                type="button"
                onClick={handleSendLabPrograms}
                disabled={validFilesCount === 0 || labSendState === 'sending'}
                className="btn-secondary text-xs py-2 px-4 font-semibold"
                style={
                  labSendState === 'sent'
                    ? { background: 'var(--success)', color: '#fff', borderColor: 'var(--success)' }
                    : labSendState === 'failed'
                    ? { background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }
                    : {}
                }
              >
                {labSendState === 'sending'
                  ? 'Saving…'
                  : labSendState === 'sent'
                  ? 'Saved ✓'
                  : labSendState === 'failed'
                  ? 'Failed'
                  : hasLoadedExisting
                  ? `Update ${validFilesCount} Files`
                  : validFilesCount <= 1
                  ? 'Save Files'
                  : `Save ${validFilesCount} Files`}
              </button>
            </div>
          </div>
        </div>
      )}

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
