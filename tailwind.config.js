/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        wiser: {
          navy: "#002060",
          blue: "#BCC0E8",
          border: "#E8ECF8",
          bg: "#F5F7FD",
          gold: "#D4AF37",
        },
      },
    },
  },
  plugins: [],
};
