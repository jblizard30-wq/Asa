import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { themeBootstrapScript } from './theme-provider';

export const metadata: Metadata = {
  title: 'Church Tasks',
  description: 'Lightweight team task management for church staff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
