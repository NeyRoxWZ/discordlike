import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-quaternary': 'var(--bg-quaternary)',
        'bg-floating': 'var(--bg-floating)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        green: 'var(--green)',
        yellow: 'var(--yellow)',
        red: 'var(--red)',
        gray: 'var(--gray)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-link': 'var(--text-link)',
        separator: 'var(--separator)',
        'input-bg': 'var(--input-bg)',
        'input-border': 'var(--input-border)'
      }
    }
  },
  plugins: []
};

export default config;
