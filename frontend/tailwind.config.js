/** @type {import('tailwindcss').Config} */

// Paleta da marca Licitrend (violeta #9D6FFF da landing).
// Mapeada sobre `indigo` para que todo o app herde a identidade sem
// reescrever classe por classe.
const brand = {
  50:  '#f6f3ff',
  100: '#eee8ff',
  200: '#ddd1fe',
  300: '#c3aafd',
  400: '#a981fb',
  500: '#9d6fff',
  600: '#7c44f0',
  700: '#6a31d6',
  800: '#5829ae',
  900: '#49238d',
  950: '#2c1260',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        indigo: brand,
        brand,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'blink-found': {
          '0%, 100%': { backgroundColor: 'rgba(34,197,94,0.10)', boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
          '50%': { backgroundColor: 'rgba(34,197,94,0.26)', boxShadow: 'inset 3px 0 0 0 rgb(34,197,94), 0 0 16px 1px rgba(34,197,94,0.35)' },
        },
        pop: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '75%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.45s cubic-bezier(0.22, 0.9, 0.36, 1) both',
        'blink-found': 'blink-found 1.1s ease-in-out infinite',
        pop: 'pop 0.35s cubic-bezier(0.22, 0.9, 0.36, 1) both',
        float: 'float 3.5s ease-in-out infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
