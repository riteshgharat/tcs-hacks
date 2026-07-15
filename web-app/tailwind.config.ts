/**
 * Design tokens from docs/Design.md §11.
 * Tailwind v4 applies these via @theme in src/styles/tailwind.css —
 * this file is the documented source of truth for the theme extension.
 */
export const designTokens = {
  colors: {
    app: { DEFAULT: "#0d1117", surface: "#161b22", raised: "#1c2230" },
    edge: { subtle: "#2a313c", strong: "#3a4250" },
    ink: { DEFAULT: "#e6edf3", secondary: "#9aa5b1", tertiary: "#6b7480" },
    accent: "#4a8bf5",
    risk: {
      0: "#3dd68c",
      1: "#f5c451",
      2: "#ff9f43",
      3: "#ff5c5c",
      4: "#d12b2b",
    },
  },
  fontFamily: {
    sans: [
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Inter",
      "sans-serif",
    ],
    mono: [
      "ui-monospace",
      "JetBrains Mono",
      "SF Mono",
      "Menlo",
      "Consolas",
      "monospace",
    ],
  },
  borderRadius: { card: "6px", chip: "4px", dot: "9999px" },
} as const;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: designTokens },
};
