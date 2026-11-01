import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api calls are proxied to the Express backend (default port 5000).
// Change VITE_API_TARGET if the backend runs elsewhere, e.g. https://localhost:5000
// when the backend serves HTTPS with the self-signed dev certificate (docs/TLS.md).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:5000",
        // Accept the self-signed dev certificate. Dev server only; production builds have no proxy.
        secure: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
  },
});
