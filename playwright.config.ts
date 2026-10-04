import {defineConfig, devices} from "@playwright/test";

/**
 * End-to-end tests with Supabase mocked at the network layer (e2e/support/mock-supabase.ts):
 * no credentials, no real project, no quota use.
 *
 * Two servers:
 *  - "ui" tests run against a production build (`vite preview`), so request budgets are
 *    measured exactly as users experience them (no dev-only StrictMode double effects);
 *  - "api" tests run against the dev server, whose middleware executes the api/ functions.
 *
 * Tuned to stay light on a dev machine: Chromium headless shell only, a few workers, no
 * videos, traces and screenshots kept only for failures.
 *   bun run test:e2e:install   # once: downloads the headless Chromium shell
 *   bun run test:e2e           # build + run the suite
 */
const UI_PORT = 4318;
const API_PORT = 4317;
// Keep in sync with MOCK_SUPABASE_URL in e2e/support/mock-supabase.ts.
const MOCK_SUPABASE_URL = "http://127.0.0.1:54399";
const isCI = !!process.env.CI;

// Process env beats .env files in Vite, so these always win over local secrets.
const MOCK_ENV = {
  VITE_SUPABASE_URL: MOCK_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_CLOUDINARY_CLOUD_NAME: "e2e-cloud",
  VITE_CLOUDINARY_UPLOAD_PRESET: "e2e-evidence",
  VITE_CLOUDINARY_AVATAR_UPLOAD_PRESET: "e2e-avatars",
  VITE_CLOUDINARY_ACADEMY_UPLOAD_PRESET: "e2e-academy",
  // Server-side variables for the locally served api/ functions: fake as well.
  SUPABASE_URL: MOCK_SUPABASE_URL,
  SUPABASE_SECRET_KEY: "e2e-secret-key",
  SUPABASE_SERVICE_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  CLOUDINARY_API_KEY: "e2e",
  CLOUDINARY_API_SECRET: "e2e",
  CRON_SECRET: "e2e-cron-secret-0123456789",
};

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 3,
  timeout: 30_000,
  expect: {timeout: 7_000},
  reporter: isCI ? [["github"], ["html", {open: "never"}]] : [["list"]],

  use: {
    locale: "hu-HU",
    timezoneId: "Europe/Budapest",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    serviceWorkers: "block",
  },

  projects: [
    {
      name: "ui",
      testIgnore: /api\.spec\.ts/,
      use: {...devices["Desktop Chrome"], viewport: {width: 1440, height: 900}, baseURL: `http://127.0.0.1:${UI_PORT}`},
    },
    {
      name: "api",
      testMatch: /api\.spec\.ts/,
      use: {baseURL: `http://127.0.0.1:${API_PORT}`},
    },
  ],

  webServer: [
    {
      // Built into a separate folder so the regular dist/ is never overwritten with a
      // mock-configured build. Rebuilt on every run (about 2 s with Rolldown).
      command: `bunx vite build --outDir .e2e-dist --emptyOutDir --logLevel warn && bunx vite preview --outDir .e2e-dist --port ${UI_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${UI_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
      env: MOCK_ENV,
    },
    {
      command: `bunx vite --port ${API_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${API_PORT}`,
      // A dedicated port: an everyday `bun run dev` (5173, real .env) is never reused.
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
      env: MOCK_ENV,
    },
  ],
});
