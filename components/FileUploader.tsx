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
        const uploadPath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const newBlob = await upload(uploadPath, file, {
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
    <div className="w-full mt-6 glass-panel rounded-3xl p-8 sm:p-10 shadow-xl text-center relative overflow-hidden border border-neutral-200/50 dark:border-neutral-700/30">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
      
      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-6 relative z-10">
        Share Files
      </h3>

      <div className="relative z-10">
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
          className={`cursor-pointer inline-flex items-center justify-center py-4 px-10 rounded-2xl font-bold text-base shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto ${
            uploading
              ? 'bg-neutral-200 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 cursor-not-allowed opacity-80'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-blue-500/30'
          }`}
        >
          <span className="text-xl mr-3 opacity-90">📁</span>
          {uploading ? (progressText || 'Uploading…') : 'Choose File(s) to Send'}
        </label>
      </div>
      <p className="mt-5 text-xs font-bold text-neutral-400 dark:text-neutral-500 relative z-10 opacity-70">
        Select multiple images or files at once • Powered by Vercel Blob
      </p>
    </div>
  );
}
