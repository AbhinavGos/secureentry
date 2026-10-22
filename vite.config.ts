import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Support both local root '/' and GitHub Pages '/secureentry/'
const basePath = process.env.BASE_PATH || "/";

// https://vitejs.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          scanner: ["@zxing/browser", "@zxing/library"],
          export: ["jszip", "qrcode", "papaparse"],
        },
      },
    },
  },
});
