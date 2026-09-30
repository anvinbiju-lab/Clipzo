'use client';
import React from 'react';

export function MessageRenderer({ text }: { text: string }) {
  if (text.startsWith('FILE::')) {
    const parts = text.split('::');
    const url = parts[1];
    const name = parts[2] || 'Download File';
    const type = parts[3] || '';

    if (type.startsWith('image/')) {
      return (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-w-full max-h-[300px] rounded-lg shadow-sm" />
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm font-semibold">
            Open / Download Image ({name})
          </a>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 bg-neutral-100 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <div className="text-3xl">📄</div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm font-semibold truncate max-w-full">
          Download File: {name}
        </a>
      </div>
    );
  }

  return (
    <pre className="font-mono text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-all leading-relaxed select-all">
      {text}
    </pre>
  );
}
