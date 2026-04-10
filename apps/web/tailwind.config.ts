import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--bg-base)",
        "surface-default": "var(--surface-default)",
        "surface-elevated": "var(--surface-elevated)",
        "primary-default": "var(--primary-default)",
        "primary-foreground": "var(--primary-foreground)",
        "cta-primary": "var(--cta-primary)",
        "cta-foreground": "var(--cta-foreground)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "border-subtle": "var(--border-subtle)",
        "coffee-accent": "var(--coffee-accent)",
        "status-error": "var(--status-error)",
        "status-success": "var(--status-success)",
        "dark-base": "var(--dark-base)",
        "dark-surface": "var(--dark-surface)",
        "dark-elevated": "var(--dark-elevated)",
        "dark-muted": "var(--dark-muted)",
        "dark-page": "var(--dark-page)",
        "dark-panel": "var(--dark-panel)",
        "dark-control": "var(--dark-control)",
        "glow-indigo": "var(--glow-indigo)",
        "glow-indigo-soft": "var(--glow-indigo-soft)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
