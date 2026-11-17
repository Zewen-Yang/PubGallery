import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://zewen-yang.github.io/PubGallery/
export default defineConfig({
  base: '/PubGallery/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
