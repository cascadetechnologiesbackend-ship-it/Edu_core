import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // ── SchoolMitra Design System ──────────────────────────────────────
        // Primary: Deep Blue — trust, authority, education
        primary: {
          DEFAULT: "#1e40af",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
          foreground: "#ffffff",
        },
        // Secondary: Emerald — growth, success, progress
        secondary: {
          DEFAULT: "#059669",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          foreground: "#ffffff",
        },
        // Warning: Amber — attention, pending states
        warning: {
          DEFAULT: "#d97706",
          light: "#fef3c7",
          foreground: "#92400e",
        },
        // Danger: Rose — errors, critical alerts
        danger: {
          DEFAULT: "#e11d48",
          light: "#fff1f2",
          foreground: "#9f1239",
        },
        // Neutral palette
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Sidebar
        sidebar: {
          DEFAULT: "#0f172a",
          hover: "#1e293b",
          active: "#1e40af",
          text: "#cbd5e1",
          "text-active": "#ffffff",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Devanagari", ...fontFamily.sans],
        mono: ["JetBrains Mono", ...fontFamily.mono],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
      boxShadow: {
        "card-hover": "0 8px 30px rgba(30, 64, 175, 0.12)",
        "sidebar-item": "inset 3px 0 0 #1e40af",
        glass: "0 4px 24px rgba(0,0,0,0.08)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)",
        "gradient-card": "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        "shimmer-skeleton":
          "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
