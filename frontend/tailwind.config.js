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
        // Les shades 300/400/500 (les plus utilisées) sont mappées sur des variables CSS
        // en canaux RGB pour supporter les modificateurs d'opacité (gold-400/10, etc.)
        // et permettre le re-théming depuis le branding du Layout.
        // Les autres shades restent en hex (peu utilisées).
        gold: {
          50:  '#FBF8EE',
          100: '#F7EFD3',
          200: '#EEDDA0',
          300: 'rgb(var(--gold-300) / <alpha-value>)',
          400: 'rgb(var(--gold-400) / <alpha-value>)',
          500: 'rgb(var(--gold-500) / <alpha-value>)',
          600: '#A07E24',
          700: '#7E631F',
          800: '#5E4A1C',
          900: '#3F3214',
        },
        // Couleur accent thématisable (suit --brand-accent, défaut = gold-300).
        brand: {
          accent: 'rgb(var(--brand-accent) / <alpha-value>)',
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
