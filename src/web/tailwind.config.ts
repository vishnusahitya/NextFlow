import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        foreground: "#e7e7e7",
        card: "#121212",
        border: "#232323",
        accent: "#b58cff",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": {
            boxShadow: "0 0 0 1px rgba(181, 140, 255, 0.25), 0 0 0 rgba(181,140,255,0)"
          },
          "50%": {
            boxShadow: "0 0 0 1px rgba(181, 140, 255, 0.65), 0 0 24px rgba(181,140,255,0.35)"
          }
        }
      },
      animation: {
        "pulse-glow": "pulseGlow 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
