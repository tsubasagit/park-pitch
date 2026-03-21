/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          navy: '#1e3a5f',
          navyLight: '#2d4a6f',
          orange: '#e85d04',
          orangeHover: '#d35400',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      boxShadow: {
        card: '0 2px 20px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 24px rgba(0, 0, 0, 0.1)',
        bar: '0 -2px 16px rgba(0, 0, 0, 0.06)',
        modal: '0 8px 40px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
