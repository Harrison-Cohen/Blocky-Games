import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
    // Three.js is the only dependency, so a single chunk is smaller overall
    // than splitting it and paying for the extra request.
    chunkSizeWarningLimit: 800,
  },
});
