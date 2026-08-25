import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: "web",
  base: "/viewer/app/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "web/src")
    }
  },
  build: {
    outDir: "../viewer/app",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4173",
      "/outputs": "http://localhost:4173",
      "/data": "http://localhost:4173"
    }
  }
});
