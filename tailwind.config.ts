import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "astro-bg": "#0f172a",
        "astro-card": "#1e293b",
        "astro-border": "#334155",
        "astro-accent": "#3b82f6",
        "astro-accent-hover": "#2563eb",
        "astro-text": "#f1f5f9",
        "astro-muted": "#94a3b8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
