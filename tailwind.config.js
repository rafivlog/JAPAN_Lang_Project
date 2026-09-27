/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#2b2118',
        paper: '#fdfaf3',
        jr: '#bc002d',
      },
      fontFamily: {
        sans: ['"Hind Siliguri"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif JP"', '"Yu Mincho"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}