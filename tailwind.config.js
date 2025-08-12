import scrollbar from "tailwind-scrollbar";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Nunito', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'display': ['Nunito', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'body': ['Source Sans 3', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'soft': ['Nunito', 'sans-serif'],
        'smooth': ['Source Sans 3', 'sans-serif'],
        'vt323': ['VT323', 'monospace'],
        'retro': ['VT323', 'monospace'], // Thêm alias khác cho VT323
      },
    },
  },
  plugins: [
    scrollbar,
  ],
}

