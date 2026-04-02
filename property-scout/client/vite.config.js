import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/property-scout/client/dist/',
  build: {
    outDir: 'dist',
  },
});
