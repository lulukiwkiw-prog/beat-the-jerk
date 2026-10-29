import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
  },
});
