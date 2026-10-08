import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'Clipzo — Instant clipboard across devices',
  description: 'Paste code on your phone, pick it up on any PC. No login, no install.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col font-sans antialiased">
        <div className="flex-1 relative flex flex-col">
          {children}
        </div>
        <footer className="w-full py-3 text-center text-[10px] font-medium tracking-wide" style={{ color: 'var(--fg-faint)' }}>
          Built by Anvin
        </footer>
      </body>
    </html>
  );
}
