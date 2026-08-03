import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  test: {
    // e2e/ holds Playwright specs, which must not be collected by vitest — its
    // default include pattern matches *.spec.ts too.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});

