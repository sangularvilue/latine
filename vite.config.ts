import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5200,
    fs: {
      strict: false,
      allow: ['..'],
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  optimizeDeps: {
    include: ['qrcode'],
  },
  build: {
    target: 'es2022',
    outDir: resolve(__dirname, 'dist'),
  },
});
