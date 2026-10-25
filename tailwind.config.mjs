/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f6f6ee',
          100: '#eceadb',
          200: '#d7d2b2',
          300: '#c1b887',
          400: '#a89d62',
          500: '#87804c',
          600: '#6a6539',
          700: '#514c2c',
          800: '#39361f',
          900: '#242213',
        },
        cream: {
          50: '#fdfcf8',
          100: '#faf7ef',
          200: '#f2ecda',
        },
        clay: {
          400: '#c97b56',
          500: '#b5583a',
          600: '#95452c',
        },
        ink: '#2b2a22',
      },
      fontFamily: {
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
