import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="row-ramp"]')
})

test('the callsign column stays put when the grid scrolls sideways', async ({ page }) => {
  const cell = page.locator('[data-testid="row-ramp"] .who')
  const before = await cell.boundingBox()
  const wrap = page.locator('.mx-wrap')
  await wrap.evaluate(el => el.scrollBy(600, 0))
  // Prove the container actually moved — sound today only because the
  // 90-day-wide table happens to exceed the viewport width on both
  // projects. Without this, a `.mx-wrap` that stopped scrolling entirely
  // would still pass, since before/after would be trivially identical.
  const scrollLeft = await wrap.evaluate(el => el.scrollLeft)
  expect(scrollLeft).toBeGreaterThan(0)
  const after = await cell.boundingBox()
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(1)
})

test('the date header stays put when the grid scrolls down', async ({ page }) => {
  // .mx-wrap's content is 1 header + 6 count rows + 16 person rows ≈ 23
  // rows × ~21px ≈ 492px, which fits inside the default viewport height on
  // both projects (664px phone, 900px desktop) — the wrapper never
  // overflows vertically there, so `scrollBy(0, 400)` would be a silent
  // no-op. Shrink the viewport so the scroller genuinely has to scroll.
  await page.setViewportSize({ width: 390, height: 320 })
  const head = page.locator('[data-testid="head-2026-01-15"]')
  const before = await head.boundingBox()
  const wrap = page.locator('.mx-wrap')
  await wrap.evaluate(el => el.scrollBy(0, 400))
  // Prove the container actually moved before trusting the "unchanged"
  // header position as evidence the header is sticky rather than evidence
  // that nothing happened.
  const scrollTop = await wrap.evaluate(el => el.scrollTop)
  expect(scrollTop).toBeGreaterThan(0)
  const after = await head.boundingBox()
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1)
})

test('the frozen column is opaque — day cells never show through it', async ({ page }) => {
  const bg = await page.locator('[data-testid="row-ramp"] .who')
    .evaluate(el => getComputedStyle(el).backgroundColor)
  expect(bg).not.toBe('rgba(0, 0, 0, 0)')
})

test('the page itself never scrolls sideways — only the grid does', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('a blocked day is painted orange on its header, and an ordinary day is not', async ({ page }) => {
  const blocked = await page.locator('[data-testid="head-2026-03-10"]')
    .evaluate(el => getComputedStyle(el).backgroundColor)
  expect(blocked).toBe('rgb(255, 165, 0)')

  const plain = await page.locator('[data-testid="head-2026-01-07"]')
    .evaluate(el => getComputedStyle(el).backgroundColor)
  expect(plain).not.toBe('rgb(255, 165, 0)')
})

test('the matrix stays within a sane DOM size', async ({ page }) => {
  // 16 people x 90 days plus counts and headers. Measured 2227 nodes on
  // 2026-08-09; ceiling set with modest headroom above that, not as a
  // target: raising it is a deliberate edit in the PR that adds the nodes.
  const nodes = await page.evaluate(() => document.querySelectorAll('.mx *').length)
  // A missing `.mx` would make this 0, which is comfortably "less than the
  // ceiling" — assert it's also nonzero so an absent grid fails loudly
  // instead of passing by accident.
  expect(nodes).toBeGreaterThan(0)
  expect(nodes).toBeLessThan(2500)
})
