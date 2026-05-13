import tailwindcssAnimate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Tight"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        accent: { DEFAULT: "#1e3a8a", foreground: "#f8fafc" },
        cold: { DEFAULT: "#84cc16", foreground: "#0f172a" },
      },
      borderRadius: { md: "0.375rem", lg: "0.5rem" },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
      },
      animation: { "pulse-subtle": "pulse-subtle 2s ease-in-out infinite" },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
