import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1b1b18",
        parchment: "#f4efe4",
        coral: "#ec6b4d",
        teal: "#0e6655",
        gold: "#d6a84f",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["'Trebuchet MS'", "'Segoe UI'", "sans-serif"],
      },
      boxShadow: {
        card: "0 20px 60px rgba(27, 27, 24, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
