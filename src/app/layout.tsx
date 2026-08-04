import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { themeBootstrapScript } from './theme-provider';
import { PwaRegister } from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'Church Tasks',
  description: 'Lightweight team task management for church staff',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#2c4a68',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
