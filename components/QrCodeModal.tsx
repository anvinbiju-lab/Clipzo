'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeModalProps {
  url: string;
  code: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QrCodeModal({ url, code, isOpen, onClose }: QrCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && url) {
      QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#171717',
          light: '#ffffff',
        },
      })
        .then((data) => setDataUrl(data))
        .catch(() => setDataUrl(null));
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Scan with Phone
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Directly opens room <span className="font-mono font-bold">{code}</span>
        </p>

        <div className="my-4 flex justify-center items-center min-h-[220px]">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`QR code for ${url}`}
              className="w-52 h-52 rounded-lg border border-neutral-100 dark:border-neutral-800"
            />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-400 text-sm">
              Generating QR...
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 px-4 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
