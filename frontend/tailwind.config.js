/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cti: {
          bg: "#0a0a14",
          surface: "#111118",
          border: "#1a1a2e",
          green: "#00ff87",
          blue: "#00d4ff",
          purple: "#a78bfa",
          pink: "#f472b6",
          amber: "#fbbf24",
          orange: "#fb923c",
        },
      },
      fontFamily: {
        mono: ["'IBM Plex Mono'", "'Fira Code'", "monospace"],
        display: ["'Space Grotesk'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
