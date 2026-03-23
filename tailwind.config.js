/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          dark: 'var(--brand-dark)',
        },
        sidebar: 'var(--sidebar-bg)',
        content: 'var(--content-bg)',
        card: 'var(--card-bg)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        purple: 'var(--purple)',
        border: 'var(--border)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        strong: 'var(--shadow-strong)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
