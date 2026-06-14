import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Design tokens (see DESIGN.md). Values are CSS vars defined in globals.css.
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        panel: "var(--panel)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        hairline: {
          DEFAULT: "var(--hairline)",
          strong: "var(--hairline-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          active: "var(--accent-active)",
          fg: "var(--accent-fg)",
          tint: "var(--accent-tint)",
          "tint-strong": "var(--accent-tint-strong)",
          mid: "var(--primary-mid)",
          darker: "var(--primary-darker)",
        },
        gold: "var(--gold)",
        type: {
          ciudadano: "var(--type-ciudadano)",
          problematica: "var(--type-problematica)",
          sociohabitacional: "var(--type-sociohabitacional)",
        },
        success: {
          DEFAULT: "var(--success)",
          tint: "var(--success-tint)",
          border: "var(--success-border)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          tint: "var(--warn-tint)",
          border: "var(--warn-border)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          tint: "var(--danger-tint)",
        },
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        header: "var(--shadow-header)",
        pop: "var(--shadow-pop)",
        modal: "var(--shadow-modal)",
      },
      ringColor: {
        accent: "var(--accent-ring)",
      },
    },
  },
  plugins: [],
}

export default config
