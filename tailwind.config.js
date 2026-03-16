/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        park: {
          navy: '#1e3a5f',
          navyLight: '#2d4a6f',
          orange: '#e85d04',
          orangeHover: '#d35400',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
