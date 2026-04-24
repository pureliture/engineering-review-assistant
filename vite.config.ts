import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "widget",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "../dist/widget",
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    lib: {
      entry: "src/main.tsx",
      name: "EngineeringReviewWidget",
      formats: ["iife"],
      fileName: () => "review-dashboard.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "review-dashboard.[ext]"
      }
    }
  }
});
