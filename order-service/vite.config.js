import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5191, proxy: { "/api": { target: "http://localhost:7841", changeOrigin: true } } },
});
