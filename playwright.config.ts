import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4173',
    // The pinned Playwright looks for a browser build this image does not
    // ship, so a bare launch dies with "Executable doesn't exist". Do NOT run
    // `npx playwright install` — point at the one that is already here.
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  projects: [
    // devices['iPhone 13'] defaults to WebKit, which this image does not
    // ship (only a Chromium build exists under /opt/pw-browsers). Force
    // Chromium explicitly so the phone project launches the browser that is
    // actually present; the rest of the iPhone 13 emulation (viewport,
    // isMobile, hasTouch, userAgent) is unaffected.
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
