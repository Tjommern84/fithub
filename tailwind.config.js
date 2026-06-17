/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        barlow: ['var(--font-barlow)', 'sans-serif'],
        heading: ['var(--font-outfit)', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      // Z-index scale — add new layers here, never use raw numbers in components
      // card(10) < bar(20) < header(30) < dropdown(40) < popup(50) < modal(100)
      zIndex: {
        card:     '10',   // content overlays inside image cards
        bar:      '20',   // fixed bottom action bars
        header:   '30',   // main sticky nav header
        dropdown: '40',   // floating menus, suggestion lists, pickers
        popup:    '50',   // small floating forms (e.g. auth popup — within header stacking context)
        modal:    '100',  // full-screen overlays with dark backdrop
      },
    },
  },
  plugins: [],
};
