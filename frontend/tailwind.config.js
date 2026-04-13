/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0F172A', light: '#1E293B' },
        teal: { DEFAULT: '#0D9488', light: '#14B8A6' },
      },
    },
  },
  plugins: [],
};
