/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./widget.html",
    "./widget-test.html",
    "./*.html",
    "./scripts/**/*.js",
    "./widget.js",
  ],
  theme: {
    extend: {
      colors: {
        'navy': '#0f2747',
        'navy-2': '#0b3954',
        'teal': '#20bfa9',
        'ink': '#1e2a3a',
        'soft': '#eef4fa',
        'card': '#ffffff',
        'line': '#d9e3ef',
      },
    },
  },
  plugins: [],
}
