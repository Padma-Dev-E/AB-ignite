import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#061A3F",
        blue: "#1E5EFF",
        electric: "#0A2A7A",
        cyan: "#3ED2FF",
        ink: "#0B1F44",
        muted: "#55678A",
        sand: "#D97706",
      },
      fontFamily: {
        sans: ["Readex Pro", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,40,100,.05), 0 10px 26px -14px rgba(11,40,100,.2)",
      },
    },
  },
  plugins: [],
};

export default config;
