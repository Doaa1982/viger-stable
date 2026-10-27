import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f6f3ee",
          100: "#ebe3d6",
          200: "#d6c5a9",
          300: "#bfa279",
          400: "#a9844f",
          500: "#8f6a37",
          600: "#73542c",
          700: "#5a4124",
          800: "#3f2e1a",
          900: "#271c10",
        },
        forest: { 500: "#2f5d50", 600: "#244a40", 700: "#1b3a32" },
      },
    },
  },
  plugins: [],
};
export default config;
