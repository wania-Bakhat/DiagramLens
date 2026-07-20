import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        editorial: ["var(--font-editorial)", "serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      colors: {
        ink: {
          950: "#040816",
          900: "#07111f",
          800: "#0d182d"
        },
        atlas: {
          rose: "#fb7185",
          ember: "#f97316",
          gold: "#fbbf24",
          sky: "#38bdf8",
          mint: "#34d399"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 24px 80px rgba(4, 10, 24, 0.45)",
        soft: "0 18px 40px rgba(2, 6, 23, 0.35)"
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top left, rgba(251, 113, 133, 0.18), transparent 28%), radial-gradient(circle at 85% 10%, rgba(56, 189, 248, 0.18), transparent 24%), linear-gradient(180deg, rgba(5, 10, 22, 1) 0%, rgba(8, 16, 33, 1) 45%, rgba(4, 8, 18, 1) 100%)"
      }
    }
  },
  plugins: []
} satisfies Config;

