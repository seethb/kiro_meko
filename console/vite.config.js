import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5190, proxy: { "/api": { target: "http://localhost:7840", changeOrigin: true } } },
});
