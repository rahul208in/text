/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1a1a1a",
        secondary: "#333",
        accent: "#666",
        highlight: "#f39c12",
        error: "#d9534f",
        warning: "#ffc107",
      },
    },
  },
  plugins: [],
};
