/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        leaf: "#2D6A4F",
        "leaf-light": "#40916C",
        "leaf-dark": "#1B4332",
        soil: "#8B7355",
        "soil-light": "#A0845C",
        sky: "#7EC8E3",
        sunlight: "#F4A460",
        danger: "#E76F51",
      },
    },
  },
  plugins: [],
};
