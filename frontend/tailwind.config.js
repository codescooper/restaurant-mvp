/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Bordures sombres par défaut (thème noir & or).
      borderColor: {
        DEFAULT: '#262626', // neutral-800
      },
      colors: {
        // Palette « gold » pour le thème noir & or.
        gold: {
          50: '#FBF8EE',
          100: '#F7EFD3',
          200: '#EEDDA0',
          300: '#E4C86A',
          400: '#D4AF37',
          500: '#C19B2E',
          600: '#A07E24',
          700: '#7E631F',
          800: '#5E4A1C',
          900: '#3F3214',
        },
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
