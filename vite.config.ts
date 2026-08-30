import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        game: resolve(process.cwd(), 'index.html'),
        editor: resolve(process.cwd(), 'editor.html'),
      },
    },
  },
});
