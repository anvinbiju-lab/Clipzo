'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { LabProgramItem } from '../types/protocol';
import { copyToClipboard } from '../lib/clipboard';
import { downloadTextAsFile } from '../lib/download';

interface LabWorkbenchProps {
  programs: LabProgramItem[];
  roomCode: string;
  onBurnWipe: () => void;
}

export function LabWorkbench({ programs, roomCode, onBurnWipe }: LabWorkbenchProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadAllStatus, setDownloadAllStatus] = useState<string | null>(null);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);

  const activeProgram = programs[activeIndex] || programs[0];

  // Alt+C hotkey to copy active code, Alt+1..9 to switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        if (activeProgram) {
          handleCopy(activeProgram.code, activeProgram.id);
        }
      } else if (e.altKey && !isNaN(Number(e.key))) {
        const num = Number(e.key);
        if (num >= 1 && num <= programs.length) {
          e.preventDefault();
          setActiveIndex(num - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProgram, programs.length]);

  const handleCopy = async (code: string, id: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopyStatus('Copied ✓');
      setCopiedId(id);
      setTimeout(() => {
        setCopyStatus(null);
        setCopiedId(null);
      }, 2000);
    }
  };

  const handleDownloadSingle = (prog: LabProgramItem) => {
    const filename = prog.name.trim() || `program_${prog.id}.txt`;
    downloadTextAsFile(prog.code, filename);
  };

  const handleDownloadAll = async () => {
    setDownloadAllStatus('Downloading…');
    for (let i = 0; i < programs.length; i++) {
      const prog = programs[i];
      const filename = prog.name.trim() || `program_${i + 1}.txt`;
      downloadTextAsFile(prog.code, filename);
      if (i < programs.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    setDownloadAllStatus('Downloaded All ✓');
    setTimeout(() => setDownloadAllStatus(null), 2500);
  };

  const lines = useMemo(() => {
    return (activeProgram?.code || '').split('\n');
  }, [activeProgram]);

  if (!programs || programs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Top Header Card */}
      <div className="card-elevated p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--accent)', borderWidth: '1px' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm" style={{ background: 'var(--accent)', color: '#000' }}>
            {roomCode}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>
                Lab Workbench
              </span>
              <span className="badge text-[11px] px-2 py-0.5" style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}>
                {programs.length} {programs.length === 1 ? 'Program' : 'Programs'} Staged
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              Keyboard shortcuts: <kbd className="px-1 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300">Alt+C</kbd> Copy code · <kbd className="px-1 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300">Alt+1..9</kbd> Switch program
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadAll}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Download all staged files"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{downloadAllStatus || 'Download All'}</span>
          </button>

          {showBurnConfirm ? (
            <div className="flex items-center gap-1 animate-fade-in">
              <button
                type="button"
                onClick={onBurnWipe}
                className="btn-primary text-xs py-2 px-3"
                style={{ background: 'var(--danger)', color: '#fff' }}
              >
                Confirm Wipe
              </button>
              <button
                type="button"
                onClick={() => setShowBurnConfirm(false)}
                className="btn-ghost text-xs py-2 px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowBurnConfirm(true)}
              className="btn-ghost text-xs py-2 px-3 font-medium cursor-pointer"
              style={{ color: 'var(--danger)' }}
              title="Purge this room and delete all programs from server"
            >
              Burn & Wipe Room
            </button>
          )}
        </div>
      </div>

      {/* Program Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {programs.map((p, idx) => {
          const isActive = idx === activeIndex;
          const lineCount = p.code.split('\n').length;
          return (
            <div
              key={p.id || idx}
              onClick={() => setActiveIndex(idx)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border text-xs whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-neutral-400 bg-neutral-900 shadow-sm text-neutral-100'
                  : 'border-neutral-800 bg-neutral-950/70 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                isActive ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {idx + 1}
              </span>
              <span className="font-mono font-medium max-w-[140px] truncate">
                {p.name || `Program ${idx + 1}`}
              </span>
              <span className="text-[10px] opacity-50 font-mono">
                {lineCount}L
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(p.code, p.id);
                }}
                className="p-1 hover:text-emerald-400 transition-colors"
                title={`Copy ${p.name}`}
              >
                {copiedId === p.id ? (
                  <span className="text-emerald-400 font-bold text-[10px]">✓</span>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Main Active Program Card */}
      {activeProgram && (
        <div className="card-elevated p-5 flex flex-col gap-4">
          {/* Active Program Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold font-mono text-neutral-100">
                {activeProgram.name || `Program ${activeIndex + 1}`}
              </span>
              {activeProgram.lang && (
                <span className="badge text-[11px] uppercase tracking-wider px-2 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--fg-muted)' }}>
                  {activeProgram.lang}
                </span>
              )}
              <span className="text-xs font-mono" style={{ color: 'var(--fg-faint)' }}>
                {lines.length} lines · {activeProgram.code.length} characters
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadSingle(activeProgram)}
                className="btn-secondary text-xs py-2 px-3"
                title="Download this file"
              >
                Save File
              </button>
              <button
                type="button"
                onClick={() => handleCopy(activeProgram.code, activeProgram.id)}
                className="btn-primary text-xs py-2 px-5 font-semibold tracking-wide"
                style={copyStatus ? { background: 'var(--success)' } : {}}
              >
                {copyStatus || 'Copy Code (Alt+C)'}
              </button>
            </div>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div
            className="rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-[500px] border border-neutral-800 bg-[#0c0c0e] select-text"
          >
            <div className="table w-full">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row hover:bg-white/[0.03] transition-colors leading-relaxed">
                  <span className="table-cell select-none pr-4 text-right text-neutral-600 font-mono text-[11px] w-10">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre text-neutral-200">
                    {line || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
