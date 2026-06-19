import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'spa',
  base: '/jeu-de-cochons/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
