import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'QuickDrop - Share instantly. No limits.',
  description: 'Ultra-fast temporary text and file transfer between any devices. No login required.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#030712',
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
    <html lang="en" className={outfit.variable}>
      <body className="min-h-screen flex flex-col font-sans bg-mesh selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-100">
        <div className="flex-1 relative z-10 flex flex-col">
          {children}
        </div>
        <aside
          aria-label="Watermark"
          className="fixed bottom-4 right-4 z-50 pointer-events-none select-none rounded-full px-3.5 py-1.5 text-[10px] font-bold tracking-widest text-neutral-500 dark:text-neutral-400 glass-panel uppercase shadow-lg"
        >
          Developed By Anvin
        </aside>
      </body>
    </html>
  );
}
