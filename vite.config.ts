import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,  // Bind to all interfaces (0.0.0.0 + ::)—allows office LAN access via 172.20.1.87
    port: 3000,  // Fixed—no fallbacks
    strictPort: true,  // Errors if busy
    open: true,  // Auto-open on start
    // Proxy API to backend (use IP for office network; localhost for local dev)
    proxy: {
      '/api': {
        target: 'http://172.20.1.87:3001',  // Backend on office IP:3001
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
  },
  preview: {
    host: true,
    port: 3000,
    open: true,
  },
}));