import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="row-ramp"]')
})

test('the callsign column stays put when the grid scrolls sideways', async ({ page }) => {
  const cell = page.locator('[data-testid="row-ramp"] .who')
  const before = await cell.boundingBox()
  await page.locator('.mx-wrap').evaluate(el => el.scrollBy(600, 0))
  const after = await cell.boundingBox()
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(1)
})

test('the date header stays put when the grid scrolls down', async ({ page }) => {
  const head = page.locator('[data-testid="head-2026-01-15"]')
  const before = await head.boundingBox()
  await page.locator('.mx-wrap').evaluate(el => el.scrollBy(0, 400))
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
  // 16 people x 90 days plus counts and headers. A ceiling rather than a
  // target: raising it is a deliberate edit in the PR that adds the nodes.
  const nodes = await page.evaluate(() => document.querySelectorAll('.mx *').length)
  expect(nodes).toBeLessThan(3600)
})
