import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { realpathSync } from 'node:fs';

const root = realpathSync(dirname(new URL(import.meta.url).pathname.slice(1)));

export default defineConfig({
  root,
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': resolve(root, 'src'),
      '@shared': resolve(root, 'shared'),
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
    outDir: resolve(root, 'dist'),
  },
});
