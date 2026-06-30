/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        retro: ['"VT323"', 'monospace'],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Pixel-specific colors
        pixel: {
          black: "#1D2B53",
          purple: "#7E2553",
          red: "#FF004D",
          orange: "#FFA300",
          yellow: "#FFEC27",
          green: "#00E436",
          blue: "#29ADFF",
          lavender: "#83769C",
          pink: "#FF77A8",
          peach: "#FFCCAA",
          white: "#FFF1E8",
          gray: "#5F574F",
          midgray: "#C2C3C7",
          navy: "#0D1B2A",
          panel: "#2A1F3D",
          "panel-light": "#3D2E56",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "0px",
        md: "0px",
        sm: "0px",
      },
      boxShadow: {
        'pixel': '4px 4px 0 0 rgba(0, 0, 0, 0.5)',
        'pixel-sm': '2px 2px 0 0 rgba(0, 0, 0, 0.5)',
        'pixel-lg': '6px 6px 0 0 rgba(0, 0, 0, 0.5)',
        'pixel-inset': 'inset -3px -3px 0 0 rgba(0,0,0,0.4), inset 3px 3px 0 0 rgba(255,255,255,0.15)',
      },
      animation: {
        'pixel-blink': 'pixel-blink 1s steps(2) infinite',
        'pixel-bounce': 'pixel-bounce 0.6s steps(4) infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
