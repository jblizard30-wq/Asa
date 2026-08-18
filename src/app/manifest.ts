import type { MetadataRoute } from 'next';
import { APP_NAME, LOGO_URL, brandHex, pageTitle } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: pageTitle,
    short_name: APP_NAME,
    start_url: '/',
    display: 'standalone',
    background_color: brandHex(50),
    theme_color: brandHex(600),
    icons: [
      {
        src: LOGO_URL || '/icon.svg',
        sizes: 'any',
        type: LOGO_URL ? 'image/png' : 'image/svg+xml',
      },
    ],
  };
}
