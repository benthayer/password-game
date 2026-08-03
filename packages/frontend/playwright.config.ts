import { defineConfig } from '@playwright/test';

/**
 * Browser tests for the coupon UI. Runs a real backend on a throwaway DATA_DIR
 * and a real vite dev server, so nothing here can touch production data or grant
 * real credit.
 *
 * Requires the backend to be built: `npm run build:backend` at the repo root.
 */

export const E2E_DATA_DIR = '/tmp/pg-e2e-data';
export const API_PORT = 3099;
export const WEB_PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // *.e2e.ts rather than *.spec.ts: vitest's default include pattern matches
  // *.spec.ts, and it would otherwise try to run these as unit tests.
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  fullyParallel: false, // shared sqlite file and shared mint budgets
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: [
    {
      // Fresh database each run, so cap counters never carry over between runs.
      command: `sh -c "rm -rf ${E2E_DATA_DIR} && node ../backend/dist/index.js"`,
      env: { DATA_DIR: E2E_DATA_DIR, PORT: String(API_PORT) },
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      // --host is required: vite otherwise binds only ::1, and Playwright's
      // readiness probe (and baseURL) use 127.0.0.1.
      command: `npx vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      env: { VITE_API_URL: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
    },
  ],
});
