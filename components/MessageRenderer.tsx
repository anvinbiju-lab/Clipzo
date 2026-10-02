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
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
          <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
            <span>📦</span> {files.length} Files Received
          </span>
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>{downloadingAll ? 'Downloading…' : '⬇️ Download All'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[350px] overflow-y-auto pr-1">
          {files.map((file, idx) => {
            const isImg = file.type?.startsWith('image/');
            return (
              <div
                key={idx}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col gap-2"
              >
                {isImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-28 object-cover rounded-lg bg-neutral-100 dark:bg-neutral-800"
                  />
                )}
                {!isImg && (
                  <div className="w-full h-16 flex items-center justify-center text-3xl bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                    📄
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-neutral-800 dark:text-neutral-200 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadOne(file)}
                    disabled={downloadingUrl === file.url}
                    className="py-1 px-2.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold text-[11px] shrink-0 transition-colors cursor-pointer"
                  >
                    {downloadingUrl === file.url ? '…' : 'Download'}
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
        <div className="flex flex-col items-center gap-3 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-w-full max-h-[300px] rounded-lg shadow-sm object-contain" />
          <div className="flex flex-wrap items-center justify-center gap-3 w-full mt-1">
            <button
              type="button"
              onClick={handleSingleDownload}
              disabled={downloadingUrl === url}
              className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{downloadingUrl === url ? 'Downloading…' : `⬇️ Download Image`}</span>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-xs font-medium underline"
            >
              Open original
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-3 bg-neutral-100 dark:bg-neutral-800 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 w-full text-center">
        <div className="text-4xl">📄</div>
        <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate max-w-full">
          {name}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button
            type="button"
            onClick={handleSingleDownload}
            disabled={downloadingUrl === url}
            className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>{downloadingUrl === url ? 'Downloading…' : '⬇️ Download File'}</span>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-xs font-medium underline"
          >
            Open original
          </a>
        </div>
      </div>
    );
  }

  return (
    <pre className="font-mono text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-all leading-relaxed select-all">
      {text}
    </pre>
  );
}
