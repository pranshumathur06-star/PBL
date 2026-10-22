import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Local-run config (Emergent-only dev plugins removed).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // lucide 1.x dropped brand logos; src/lib/lucide-react.tsx restores them on top of the real package.
      { find: /^lucide-react$/, replacement: path.resolve(__dirname, "./src/lib/lucide-react.tsx") },
      { find: "lucide-react-upstream", replacement: path.resolve(__dirname, "./node_modules/lucide-react") },
      // recharts 3 Tooltip typing adapter.
      { find: /^recharts$/, replacement: path.resolve(__dirname, "./src/lib/recharts.tsx") },
      { find: "recharts-upstream", replacement: path.resolve(__dirname, "./node_modules/recharts") },
    ],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": { target: "http://localhost:8001", changeOrigin: true },
    },
  },
});
