import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
      '/v1': {
        target: 'http://localhost:8400',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8400',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8400',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://localhost:8400',
        changeOrigin: true,
      },
    },
  },
});
