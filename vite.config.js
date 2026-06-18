import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'spa',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
