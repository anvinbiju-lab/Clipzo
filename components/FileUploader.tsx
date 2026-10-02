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
        setProgressText('Uploading file…');
        const newBlob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
        });
        const payload = `FILE::${newBlob.url}::${file.name}::${file.type}`;
        const success = await onSendFile(payload, file.name, file.type);
        if (!success) {
          alert('File uploaded to storage, but could not be delivered to the receiver. Make sure the receiver is connected.');
        }
      } else {
        const uploadedItems: FileItem[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setProgressText(`Uploading ${i + 1} of ${selectedFiles.length}…`);
          const newBlob = await upload(file.name, file, {
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

        setProgressText('Delivering files…');
        const payload = `FILES::${JSON.stringify(uploadedItems)}`;
        const success = await onSendFile(payload, `${selectedFiles.length} files`, 'multipart');
        if (!success) {
          alert('Files uploaded to storage, but could not be delivered to the receiver. Make sure the receiver is connected.');
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload failed', err);
      alert(`Failed to upload file(s): ${err?.message || 'Check storage token'}`);
    } finally {
      setUploading(false);
      setProgressText(null);
    }
  };

  return (
    <div className="w-full mt-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm text-center">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        Share Files
      </h3>

      <div>
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
          className={`cursor-pointer inline-flex items-center justify-center py-3.5 px-7 rounded-xl font-bold text-sm shadow-sm transition-all ${
            uploading
              ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
              : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900'
          }`}
        >
          {uploading ? (progressText || 'Uploading…') : '📁 Choose File(s) to Send'}
        </label>
      </div>
      <p className="mt-3 text-xs text-neutral-400">
        You can select multiple images or files at once • Powered by Vercel Blob
      </p>
    </div>
  );
}
