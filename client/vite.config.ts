import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/zpl': {
        target: 'http://localhost:9100',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/zpl/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
