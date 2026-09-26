import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      fontFamily: {
        sans: ["Urbanist", "system-ui", "sans-serif"],
      },
      colors: {
        // App background - very light lavender/off-white
        background: "#F7F5FB",
        surface: "#FFFFFF",
        foreground: "#141319",
        muted: "#8A8794",
        "muted-foreground": "#8A8794",
        border: "#ECE9F2",
        primary: {
          DEFAULT: "#0E0D12",
          foreground: "#FFFFFF",
        },
        // Soft category colors, matching the KED figma palette
        category: {
          income: { DEFAULT: "#E8F0E4", fg: "#3B6B3B", ring: "#5FA85F" },
          tithe: { DEFAULT: "#F3EFDD", fg: "#7A6C2E", ring: "#C9B94A" },
          investment: { DEFAULT: "#FBF1E6", fg: "#8A5A2B", ring: "#5FA85F" },
          giving: { DEFAULT: "#FBE7D4", fg: "#8A4E1F", ring: "#E08A3C" },
          expense: { DEFAULT: "#ECE7FA", fg: "#4B3E8A", ring: "#8A6FE0" },
          savings: { DEFAULT: "#FCEFE0", fg: "#8A5A2B", ring: "#E0B23C" },
        },
        success: "#3F9142",
        warning: "#C7861E",
        danger: "#D2493C",

                progress: {
    safe: "#a3e6a1",    // green
    warn: "#f6e38f",    // yellow
    danger: "#f4a3a3",
    empty: "#ffffff00",  // red
  },
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2rem",
      },
      boxShadow: {
        card: "0 2px 10px rgba(20, 19, 25, 0.04)",
        sheet: "0 -8px 30px rgba(20, 19, 25, 0.12)",
      },

      keyframes: {
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "sheet-up": "sheet-up 220ms ease-out",
        "fade-in": "fade-in 150ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
