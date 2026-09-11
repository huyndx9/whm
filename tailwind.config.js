/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0F4C5C", light: "#1A7A6D" },
        accent: "#FF6B35",
      },
      fontFamily: {
        sans: ["Pretendard", "'Noto Sans KR'", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
