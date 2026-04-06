import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Property-Scout/',
  build: {
    outDir: 'dist',
  },
});
