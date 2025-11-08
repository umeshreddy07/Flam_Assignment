import { defineConfig } from 'vite';

export default defineConfig({
  root: './client',
  server: {
    port: 5173,
    https: false
  },
  build: {
    outDir: '../dist/client',
  },
  resolve: {
    alias: {
      '@': '/client/src',
    },
  },
});

