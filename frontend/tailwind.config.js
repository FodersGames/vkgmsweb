/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // ── shadcn/radix CSS-variable tokens (kept for UI library compat) ──
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card:        { DEFAULT: 'hsl(var(--card))',        foreground: 'hsl(var(--card-foreground))' },
        popover:     { DEFAULT: 'hsl(var(--popover))',     foreground: 'hsl(var(--popover-foreground))' },
        primary:     { DEFAULT: 'hsl(var(--primary))',     foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))',   foreground: 'hsl(var(--secondary-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))',       foreground: 'hsl(var(--muted-foreground))' },
        accent:      { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border:  'hsl(var(--border))',
        input:   'hsl(var(--input))',
        ring:    'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))', '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))', '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // ── TailAdmin design tokens ────────────────────────────────────────
        // Brand teal (VakarGames #4ECDC4 as brand-400)
        brand: {
          25:  '#f0fffe',
          50:  '#e9fdfc',
          100: '#c0f9f5',
          200: '#7ef0ea',
          300: '#52dbd4',
          400: '#4ECDC4',
          500: '#30b8b0',
          600: '#229691',
          700: '#157472',
          800: '#0d5452',
          900: '#073838',
          950: '#041c1c',
        },
        // Extended gray palette (TailAdmin)
        gray: {
          25:  '#FCFCFD',
          50:  '#F9FAFB',
          100: '#F2F4F7',
          200: '#EAECF0',
          300: '#D0D5DD',
          400: '#98A2B3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1D2939',
          900: '#101828',
          950: '#0C111D',
        },
        // Semantic colors
        success: {
          50:  '#ECFDF3', 100: '#D1FADF', 300: '#6CE9A6',
          400: '#32D583', 500: '#12B76A', 600: '#039855',
          700: '#027A48', 800: '#05603A', 900: '#054F31',
        },
        error: {
          50:  '#FEF3F2', 100: '#FEE4E2', 200: '#FECDCA',
          300: '#FDA29B', 400: '#F97066', 500: '#F04438',
          600: '#D92D20', 700: '#B42318', 800: '#912018', 900: '#7A271A',
        },
        warning: {
          50:  '#FFFAEB', 100: '#FEF0C7', 300: '#FEC84B',
          400: '#FDB022', 500: '#F79009', 600: '#DC6803',
          700: '#B54708', 800: '#93370D', 900: '#7A2E0E',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans:   ['Outfit', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        'theme-sm': '0 1px 3px 0 rgba(16,24,40,0.10), 0 1px 2px 0 rgba(16,24,40,0.06)',
        'theme-md': '0 4px 8px -2px rgba(16,24,40,0.10), 0 2px 4px -2px rgba(16,24,40,0.06)',
        'theme-lg': '0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)',
        'theme-xl': '0 20px 24px -4px rgba(16,24,40,0.08), 0 8px 8px -4px rgba(16,24,40,0.03)',
      },
      fontSize: {
        'theme-xs': ['12px', { lineHeight: '18px' }],
        'theme-sm': ['14px', { lineHeight: '20px' }],
        'theme-md': ['16px', { lineHeight: '24px' }],
        'theme-lg': ['18px', { lineHeight: '28px' }],
        'theme-xl': ['20px', { lineHeight: '30px' }],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};