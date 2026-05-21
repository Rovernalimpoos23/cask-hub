import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f9f8f7',
        surface: '#ffffff',
        surface2: '#f4f3f1',
        border: '#e8e5e1',
        border2: '#d4d0ca',
        text: {
          DEFAULT: '#1a1917',
          2: '#3a3834',
          3: '#a8a29e',
        },
        red: {
          DEFAULT: '#c8311a',
          soft: '#fdf2f0',
          border: '#f5c9c2',
        },
        charcoal: '#1a1917',
        sidebar: '#1c1c1e',
        green: {
          DEFAULT: '#166534',
          bg: '#f0fdf4',
        },
        amber: {
          DEFAULT: '#92400e',
          bg: '#fffbeb',
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['Geist', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
      gridTemplateColumns: {
        'app': '232px 1fr 300px',
      },
    },
  },
  plugins: [],
}
export default config
