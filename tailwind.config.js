/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-darkest': '#040814',
        'brand-primary': '#070d1e',
        'brand-surface': '#0c152e',
      },
    },
  },
  plugins: [],
}
