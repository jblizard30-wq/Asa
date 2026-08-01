import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f6fc',
          100: '#e3ecf8',
          200: '#c2d7ee',
          300: '#8fb6de',
          400: '#548fc9',
          500: '#2f70ac',
          600: '#22568b',
          700: '#1c4571',
          800: '#1a3a5e',
          900: '#19324f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
