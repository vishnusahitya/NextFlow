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
        background: "#0b0b0d",
        foreground: "#f1f1f1",
        card: "#131316",
        border: "#26262b",
        accent: "#b58cff",
        muted: "#a3a3ad",
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
