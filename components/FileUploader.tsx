'use client';

import React, { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import type { FileItem } from './MessageRenderer';

export function FileUploader({
  onSendFile,
}: {
  onSendFile: (payload: string, name?: string, type?: string) => Promise<boolean>;
}) {
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);

      if (selectedFiles.length === 1) {
        const file = selectedFiles[0];
        setProgressText('Uploading…');
        const uploadPath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const newBlob = await upload(uploadPath, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
        });
        const payload = `FILE::${newBlob.url}::${file.name}::${file.type}`;
        const success = await onSendFile(payload, file.name, file.type);
        if (!success) {
          alert('File uploaded but delivery failed. Ensure receiver is connected.');
        }
      } else {
        const uploadedItems: FileItem[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setProgressText(`${i + 1}/${selectedFiles.length}`);
          const uploadPath = `${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const newBlob = await upload(uploadPath, file, {
            access: 'public',
            handleUploadUrl: '/api/upload',
          });
          uploadedItems.push({
            url: newBlob.url,
            name: file.name,
            type: file.type,
            size: file.size,
          });
        }

        setProgressText('Delivering…');
        const payload = `FILES::${JSON.stringify(uploadedItems)}`;
        const success = await onSendFile(payload, `${selectedFiles.length} files`, 'multipart');
        if (!success) {
          alert('Files uploaded but delivery failed. Ensure receiver is connected.');
        }
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Upload failed', err);
      alert(`Upload failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      setProgressText(null);
    }
  };

  return (
    <div className="card-elevated p-5">
      <div className="label mb-3">Files</div>
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
        disabled={uploading}
      />
      <label
        htmlFor="file-upload"
        className={`flex items-center justify-center gap-2 w-full py-3 px-5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          uploading
            ? 'opacity-50 cursor-not-allowed'
            : ''
        }`}
        style={{
          background: uploading ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
          color: uploading ? 'var(--fg-faint)' : 'var(--fg-muted)',
          border: '1px dashed var(--border)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {uploading ? (progressText || 'Uploading…') : 'Choose files'}
      </label>
    </div>
  );
}
