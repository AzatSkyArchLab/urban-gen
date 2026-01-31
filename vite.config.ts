import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for deployment at mdlaba.ru/urbangen
  base: '/urbangen/',

  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild'
  },

  server: {
    port: 5173,
    open: true
  }
});
