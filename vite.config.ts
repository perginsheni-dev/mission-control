import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const catalogProxy = {
  '/nasa-catalog': {
    target: 'https://data.nasa.gov',
    changeOrigin: true,
    rewrite: () => '/data.json',
  },
};

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: catalogProxy },
  preview: { proxy: catalogProxy },
});
