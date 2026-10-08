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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && url) {
      QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: '#18181b', light: '#ffffff' },
      })
        .then((data) => setDataUrl(data))
        .catch(() => setDataUrl(null));
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs p-6 rounded-xl text-center animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--fg)' }}>Scan to join</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
          Room <span className="font-mono font-bold">{code}</span>
        </p>

        <div className="flex justify-center items-center min-h-[180px]">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR for ${url}`} className="w-44 h-44 rounded-lg" style={{ border: '1px solid var(--border)' }} />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center rounded-lg text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--fg-faint)' }}>
              Generating…
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="btn-primary text-xs py-2 px-3 flex-1"
          >
            {copied ? 'Link copied! ✓' : 'Copy link'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary text-xs py-2 px-3">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
