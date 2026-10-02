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
      <div className="flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200/50 dark:border-neutral-700/50">
          <span className="font-bold text-base text-neutral-900 dark:text-white flex items-center gap-2">
            <span className="text-xl">📦</span> {files.length} Files Received
          </span>
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transform hover:-translate-y-0.5"
          >
            <span>{downloadingAll ? 'Downloading…' : '⬇️ Download All'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {files.map((file, idx) => {
            const isImg = file.type?.startsWith('image/');
            return (
              <div
                key={idx}
                className="bg-white/80 dark:bg-black/30 backdrop-blur-md border border-neutral-200/60 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
              >
                {isImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-32 object-cover rounded-xl bg-neutral-100 dark:bg-neutral-800 shadow-inner"
                  />
                )}
                {!isImg && (
                  <div className="w-full h-24 flex items-center justify-center text-4xl bg-neutral-100/50 dark:bg-white/5 rounded-xl border border-neutral-200/30 dark:border-white/5 shadow-inner">
                    📄
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono font-medium text-sm text-neutral-800 dark:text-neutral-200 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadOne(file)}
                    disabled={downloadingUrl === file.url}
                    className="py-1.5 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-bold text-xs shrink-0 transition-all cursor-pointer shadow-sm transform hover:scale-105"
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

  if (text.startsWith('FILE::')) {
    const parts = text.split('::');
    const url = parts[1];
    const name = parts[2] || 'Download File';
    const type = parts[3] || '';
    const isImage = type.startsWith('image/');

    const handleSingleDownload = async () => {
      setDownloadingUrl(url);
      await triggerDownload(url, name);
      setDownloadingUrl(null);
    };

    if (isImage) {
      return (
        <div className="flex flex-col items-center gap-4 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-w-full max-h-[350px] rounded-2xl shadow-lg object-contain border border-neutral-200/30 dark:border-white/10" />
          <div className="flex flex-wrap items-center justify-center gap-4 w-full mt-2">
            <button
              type="button"
              onClick={handleSingleDownload}
              disabled={downloadingUrl === url}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>{downloadingUrl === url ? 'Downloading…' : `⬇️ Save Image`}</span>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-sm font-bold underline transition-colors"
            >
              Open original
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 bg-white/50 dark:bg-black/30 backdrop-blur-md p-8 rounded-3xl border border-neutral-200/60 dark:border-white/10 w-full text-center shadow-sm">
        <div className="text-6xl drop-shadow-sm mb-2">📄</div>
        <div className="font-bold text-lg text-neutral-900 dark:text-white truncate max-w-full px-4">
          {name}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-3">
          <button
            type="button"
            onClick={handleSingleDownload}
            disabled={downloadingUrl === url}
            className="py-3 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
          >
            <span>{downloadingUrl === url ? 'Downloading…' : '⬇️ Save File'}</span>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-sm font-bold underline transition-colors"
          >
            Open original
          </a>
        </div>
      </div>
    );
  }

  return (
    <pre className="font-mono text-base text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-all leading-relaxed select-all">
      {text}
    </pre>
  );
}
