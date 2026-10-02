'use client';

import React, { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';

export function FileUploader({ onSendFile }: { onSendFile: (payload: string, name?: string, type?: string) => Promise<boolean> }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });
      
      const payload = `FILE::${newBlob.url}::${file.name}::${file.type}`;
      const success = await onSendFile(payload, file.name, file.type);
      
      if (!success) {
        alert('File uploaded to storage, but could not be sent to the peer. Make sure the other device is connected.');
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload failed', err);
      alert(`Failed to upload file: ${err?.message || 'Check storage token'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full mt-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm text-center">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
        Share a File
      </h3>
      
      <div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          id="file-upload" 
        />
        <label 
          htmlFor="file-upload" 
          className={`cursor-pointer inline-flex items-center justify-center py-3 px-6 rounded-xl font-bold text-sm shadow-sm transition-all ${
            uploading 
            ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
            : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900'
          }`}
        >
          {uploading ? 'Uploading...' : 'Choose File to Send'}
        </label>
      </div>
      <p className="mt-3 text-xs text-neutral-400">Powered by Vercel Blob</p>
    </div>
  );
}
