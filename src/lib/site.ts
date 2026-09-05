/**
 * Single source of truth for per-deployment branding. Every value here is
 * env-var driven so the identical codebase can be redeployed per customer
 * (one Vercel project + one Neon DB each) with no code fork. Defaults are
 * intentionally blank/neutral, not any specific customer's branding — every
 * real deployment, including the first one, sets these explicitly.
 */

export const ORG_NAME = process.env.ORG_NAME?.trim() || '';
export const LOGO_URL = process.env.LOGO_URL?.trim() || null;
export const BRAND_COLOR = process.env.BRAND_COLOR?.trim() || '#64748b';

export const APP_NAME = 'Asa';

export const pageTitle = ORG_NAME ? `${APP_NAME} · ${ORG_NAME}` : APP_NAME;

export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, '')}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

const LOGO_MIME_BY_EXTENSION: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
};

/**
 * Web manifest icon `type` for LOGO_URL, derived from its file extension
 * instead of assumed — deployments' logos aren't guaranteed to be PNGs.
 * Falls back to the bundled icon.svg's type when LOGO_URL is unset.
 */
export function logoMimeType(): string {
  if (!LOGO_URL) return 'image/svg+xml';
  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(LOGO_URL)?.[1]?.toLowerCase();
  return (extension && LOGO_MIME_BY_EXTENSION[extension]) || 'image/png';
}

function hexToHsl(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const SHADE_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type BrandShade = (typeof SHADE_KEYS)[number];

/**
 * Expands a single base color (treated as the "600" shade) into the full
 * 50-950 ramp `tailwind.config.ts` expects, so a deployment only ever has
 * to supply one hex value. Lighter shades move toward near-white, darker
 * shades toward near-black, anchored on the input's hue/saturation.
 */
export function deriveBrandScale(baseHex: string): Record<BrandShade, string> {
  const [h, s, l] = hexToHsl(baseHex);
  const lightnessFor: Record<BrandShade, number> = {
    50: lerp(l, 98, 0.97),
    100: lerp(l, 98, 0.88),
    200: lerp(l, 98, 0.72),
    300: lerp(l, 98, 0.52),
    400: lerp(l, 98, 0.28),
    500: lerp(l, 98, 0.1),
    600: l,
    700: lerp(l, 6, 0.25),
    800: lerp(l, 6, 0.5),
    900: lerp(l, 6, 0.72),
    950: lerp(l, 6, 0.85),
  };

  const scale = {} as Record<BrandShade, string>;
  for (const key of SHADE_KEYS) {
    const [r, g, b] = hslToRgb(h, s, lightnessFor[key]);
    scale[key] = `${r} ${g} ${b}`; // space-separated RGB triple for rgb(var(--x) / <alpha-value>)
  }
  return scale;
}

export const brandScale = deriveBrandScale(BRAND_COLOR);

export function brandScaleCssVars(): string {
  return SHADE_KEYS.map((key) => `--brand-${key}: ${brandScale[key]};`).join(' ');
}

function rgbTripleToHex(triple: string): string {
  const [r, g, b] = triple.split(' ').map(Number);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function brandHex(shade: BrandShade): string {
  return rgbTripleToHex(brandScale[shade]);
}

export const BRAND_600_HEX = brandHex(600);
