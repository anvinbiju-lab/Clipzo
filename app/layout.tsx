import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuickDrop - Phone to PC. No login.',
  description: 'Ultra-fast temporary text and code transfer from mobile to PC.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
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
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 selection:bg-neutral-200 dark:selection:bg-neutral-800">
        {children}
        <aside
          aria-label="Watermark"
          className="fixed bottom-3 right-3 z-50 pointer-events-none select-none rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide text-neutral-400 dark:text-neutral-500 bg-white/75 dark:bg-neutral-900/75 backdrop-blur-md border border-neutral-200/60 dark:border-neutral-800/60 shadow-xs"
        >
          Developed By Anvin
        </aside>
      </body>
    </html>
  );
}
