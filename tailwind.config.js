/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9f0',
          100: '#dcf0dc',
          200: '#b8e0b8',
          300: '#8ccb8c',
          400: '#5cb35c',
          500: '#2f8f2f',
          600: '#1f7a1f',
          700: '#186318',
          800: '#154f15',
          900: '#124012',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
