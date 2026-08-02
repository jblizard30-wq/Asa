import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Palette sampled from chespres.org: navy primary, sky accent, coral CTA, teal highlight.
        brand: {
          50: '#eef3f8',
          100: '#dde7f0',
          200: '#b9d0e3',
          300: '#96c7ef',
          400: '#6597bd',
          500: '#3f7096',
          600: '#2c4a68',
          700: '#223a53',
          800: '#182a3d',
          900: '#101d2a',
          950: '#0a1420',
        },
        accent: {
          coral: '#f95759',
          teal: '#68ccd1',
        },
      },
    },
  },
  plugins: [],
};

export default config;
