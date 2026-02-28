import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f8ff',
          100: '#e6ecff',
          500: '#365ff7',
          700: '#203eb6',
          900: '#12255f'
        }
      }
    }
  },
  plugins: []
};

export default config;
