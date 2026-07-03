import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8eb6ff",
          400: "#588fff",
          500: "#3066ff",
          600: "#1a47f5",
          700: "#1535e1",
          800: "#182eb6",
          900: "#1a2d8f",
        },
        // Relationship-health status palette (PRD §6.7)
        status: {
          recent: "#16a34a", // green  - recently met / on track
          scheduled: "#2563eb", // blue - scheduled meeting
          soon: "#d97706", // amber  - due soon
          overdue: "#dc2626", // red   - overdue
          paused: "#6b7280", // grey  - paused / inactive
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.03), 0 10px 28px -14px rgb(16 24 40 / 0.10)",
        cardhover: "0 2px 4px 0 rgb(16 24 40 / 0.04), 0 16px 40px -16px rgb(16 24 40 / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
