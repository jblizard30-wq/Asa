import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { themeBootstrapScript } from './theme-provider';
import { PwaRegister } from '@/components/PwaRegister';
import { ORG_NAME, LOGO_URL, BRAND_600_HEX, pageTitle, brandScaleCssVars } from '@/lib/site';

export const metadata: Metadata = {
  title: pageTitle,
  description: ORG_NAME
    ? `Team task management for ${ORG_NAME} staff`
    : 'Team task management',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: LOGO_URL || '/icon.svg',
    apple: LOGO_URL || '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_600_HEX,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root { ${brandScaleCssVars()} }` }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
