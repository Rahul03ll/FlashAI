import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#f7f5f0",
        ink: "#0a0a0f",
        accent: "#5b4fff",
        "accent-hover": "#4f43ee",
        coral: "#ff6b6b",
        mint: "#00c896",
        warn: "#f59e0b",
        danger: "#ef4444",
        "comic-yellow": "#FFE566",
        "comic-blue": "#4FC3F7",
        "comic-green": "#69F0AE",
        "comic-red": "#FF5252",
        "comic-purple": "#CE93D8",
        "comic-orange": "#FFB74D",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(10, 10, 15, 0.08)",
        hard: "4px 4px 0px 0px #0a0a0f",
        "hard-sm": "2px 2px 0px 0px #0a0a0f",
        "hard-accent": "4px 4px 0px 0px #5b4fff",
        comic: "3px 3px 0px 0px #0a0a0f",
        "comic-lg": "5px 5px 0px 0px #0a0a0f",
        "comic-sm": "2px 2px 0px 0px #0a0a0f",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "70%": { transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        "float-delayed": "float-delayed 4s ease-in-out infinite 1s",
        "pop-in": "pop-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-up": "slide-up 0.3s ease-out both",
        wiggle: "wiggle 0.5s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
