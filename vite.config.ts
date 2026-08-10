import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Raised from vitest's 5s default on 10 Aug 26, because the suite had
    // started failing about one run in three — always a different test, always
    // at 5–8s, always passing on its own.
    //
    // Nothing hangs. A war became a whole YEAR on screen, so most interface
    // tests now render 365 columns and about 9,200 nodes, and several dozen of
    // those run in parallel across workers. Under that load a heavy test
    // genuinely takes longer than five seconds.
    //
    // 20s is headroom, not a target: a test that really hangs still fails, and
    // if the ordinary case ever approaches this the answer is to make the
    // rendering cheaper rather than to raise the number again.
    testTimeout: 20_000,
    env: {
      TZ: 'Pacific/Midway',
    },
  },
})
