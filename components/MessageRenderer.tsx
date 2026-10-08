'use client';
import React, { useState } from 'react';
import { triggerDownload, downloadAllFiles } from '../lib/download';

export interface FileItem {
  url: string;
  name: string;
  type: string;
  size?: number;
}

export function MessageRenderer({ text }: { text: string }) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  // Multiple files
  if (text.startsWith('FILES::')) {
    let files: FileItem[] = [];
    try {
      files = JSON.parse(text.substring('FILES::'.length));
    } catch {
      files = [];
    }

    const handleDownloadAll = async () => {
      setDownloadingAll(true);
      await downloadAllFiles(files);
      setDownloadingAll(false);
    };

    const handleDownloadOne = async (file: FileItem) => {
      setDownloadingUrl(file.url);
      await triggerDownload(file.url, file.name);
      setDownloadingUrl(null);
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            {files.length} files
          </span>
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="btn-primary text-xs py-1.5 px-3"
            style={{ background: 'var(--success)' }}
          >
            {downloadingAll ? 'Downloading…' : 'Download all'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto">
          {files.map((file, idx) => {
            const isImg = file.type?.startsWith('image/');
            return (
              <div key={idx} className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                {isImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt={file.name} className="w-full h-28 object-cover rounded-md" style={{ background: 'var(--bg-tertiary)' }} />
                )}
                {!isImg && (
                  <div className="w-full h-16 flex items-center justify-center rounded-md" style={{ background: 'var(--bg-tertiary)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-faint)' }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs truncate" style={{ color: 'var(--fg-muted)' }} title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadOne(file)}
                    disabled={downloadingUrl === file.url}
                    className="btn-ghost text-[11px] px-2 py-1 shrink-0"
                  >
                    {downloadingUrl === file.url ? '…' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Single file
  if (text.startsWith('FILE::')) {
    const parts = text.split('::');
    const url = parts[1];
    const name = parts[2] || 'File';
    const type = parts[3] || '';
    const isImage = type.startsWith('image/');

    const handleSingleDownload = async () => {
      setDownloadingUrl(url);
      await triggerDownload(url, name);
      setDownloadingUrl(null);
    };

    if (isImage) {
      return (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-w-full max-h-[300px] rounded-lg object-contain" />
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSingleDownload} disabled={downloadingUrl === url} className="btn-primary text-xs py-2 px-4" style={{ background: 'var(--success)' }}>
              {downloadingUrl === url ? 'Downloading…' : 'Save image'}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium underline" style={{ color: 'var(--fg-muted)' }}>
              Open
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-faint)' }}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="font-mono text-sm font-medium" style={{ color: 'var(--fg)' }}>{name}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleSingleDownload} disabled={downloadingUrl === url} className="btn-primary text-xs py-2 px-4" style={{ background: 'var(--success)' }}>
            {downloadingUrl === url ? 'Downloading…' : 'Save file'}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium underline" style={{ color: 'var(--fg-muted)' }}>
            Open
          </a>
        </div>
      </div>
    );
  }

  // Plain text / code
  return (
    <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all select-all" style={{ color: 'var(--fg)' }}>
      {text}
    </pre>
  );
}
