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
    setLabPrograms([{ id: '1', name: '01_program.c', code: '', lang: 'c' }]);
    setActiveLabIndex(0);
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

  const [mode, setMode] = useState<'single' | 'lab'>('single');
  const [labPrograms, setLabPrograms] = useState<LabProgramItem[]>([
    { id: '1', name: '01_program.c', code: '', lang: 'c' },
  ]);
  const [activeLabIndex, setActiveLabIndex] = useState(0);
  const [labSendState, setLabSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddProgram = () => {
    if (labPrograms.length >= 20) return;
    const newIdx = labPrograms.length + 1;
    const id = Math.random().toString(36).substring(2, 7);
    const newProg: LabProgramItem = {
      id,
      name: `0${newIdx}_program.c`,
      code: '',
      lang: 'c',
    };
    setLabPrograms((prev) => [...prev, newProg]);
    setActiveLabIndex(labPrograms.length);
  };

  const handleRemoveProgram = (index: number) => {
    if (labPrograms.length <= 1) return;
    setLabPrograms((prev) => prev.filter((_, idx) => idx !== index));
    if (activeLabIndex >= labPrograms.length - 1) {
      setActiveLabIndex(Math.max(0, labPrograms.length - 2));
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

  const handleSendLabPrograms = async () => {
    const valid = labPrograms.filter((p) => p.code.trim().length > 0);
    if (valid.length === 0 || labSendState === 'sending') return;

    setLabSendState('sending');
    const payload = PROGRAMS_PREFIX + JSON.stringify(valid);
    const success = await onSendMessage(payload);

    if (success) {
      setLabSendState('sent');
      setTimeout(() => setLabSendState('idle'), 3000);
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

      {/* Mode Switcher */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 p-1 rounded-lg border border-neutral-800 bg-neutral-900/60">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
              mode === 'single'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Quick Snippet / File
          </button>
          <button
            type="button"
            onClick={() => setMode('lab')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              mode === 'lab'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Lab Locker (Multi-Program)
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
        </>
      ) : (
        /* Lab Mode: Multi-Program Stager */
        <div className="card-elevated p-5 flex flex-col gap-4" style={{ borderColor: 'var(--accent)', borderWidth: '1px' }}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-800">
            <div>
              <div className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <span>Lab Locker Programs</span>
                <span className="badge text-[11px] px-2 py-0.5" style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}>
                  {labPrograms.length} {labPrograms.length === 1 ? 'Program' : 'Programs'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Stage multiple programs or outputs. Pick up on your lab PC using code <span className="font-mono font-bold text-neutral-200">{code}</span>.
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
                title="Batch import multiple code files"
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
                title="Add another program tab"
              >
                <span>+ Add Program</span>
              </button>
            </div>
          </div>

          {/* Program Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {labPrograms.map((p, idx) => {
              const isActive = idx === activeLabIndex;
              return (
                <div
                  key={p.id || idx}
                  onClick={() => setActiveLabIndex(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer transition-all border text-xs whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-neutral-400 bg-neutral-900 text-neutral-100 font-semibold'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span className="font-mono text-[11px] opacity-60">#{idx + 1}</span>
                  <span className="font-mono truncate max-w-[120px]">{p.name || `Program ${idx + 1}`}</span>
                  {labPrograms.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProgram(idx);
                      }}
                      className="ml-1 text-neutral-500 hover:text-red-400 text-xs leading-none"
                      title="Remove program"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Program Editor */}
          {labPrograms[activeLabIndex] && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-neutral-400 mb-1 block">
                    Program / File Name
                  </label>
                  <input
                    type="text"
                    value={labPrograms[activeLabIndex].name}
                    onChange={(e) => updateActiveProgram('name', e.target.value)}
                    placeholder="e.g. 01_fcfs.c or Bankers.java"
                    className="input-field text-xs font-mono py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-1 block">
                    Language / Mode
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
                    <option value="txt">Output / Plain Text</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-400">
                    Source Code or Output
                  </label>
                  <span className="text-[11px] font-mono text-neutral-500">
                    {labPrograms[activeLabIndex].code.split('\n').length} lines · {labPrograms[activeLabIndex].code.length} chars
                  </span>
                </div>
                <textarea
                  value={labPrograms[activeLabIndex].code}
                  onChange={(e) => updateActiveProgram('code', e.target.value)}
                  placeholder="Paste your source code or program output here…"
                  rows={8}
                  className="input-field font-mono text-xs leading-relaxed resize-y"
                  style={{ minHeight: '160px' }}
                />
              </div>
            </div>
          )}

          {/* Send / Stage Action */}
          <div className="mt-2 pt-3 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono text-neutral-400">
              {labPrograms.filter((p) => p.code.trim().length > 0).length} of {labPrograms.length} programs ready
            </span>
            <button
              type="button"
              onClick={handleSendLabPrograms}
              disabled={
                labPrograms.filter((p) => p.code.trim().length > 0).length === 0 ||
                labSendState === 'sending'
              }
              className="btn-primary text-sm py-2.5 px-6 font-semibold"
              style={
                labSendState === 'sent'
                  ? { background: 'var(--success)' }
                  : labSendState === 'failed'
                  ? { background: 'var(--danger)' }
                  : {}
              }
            >
              {labSendState === 'sending'
                ? 'Staging…'
                : labSendState === 'sent'
                ? 'Staged to Lab PC ✓'
                : labSendState === 'failed'
                ? 'Failed'
                : `Stage & Send ${labPrograms.length} Programs`}
            </button>
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
