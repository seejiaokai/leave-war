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

// The Raptor restyle repaints .blocked as a tinted amber fill
// (rgba(229, 168, 59, 0.22)) rather than a solid rgb(255, 165, 0) — see the
// cascade-order comment on `.mx thead th.blocked` in matrix.css.
const BLOCKED_BG = 'rgba(229, 168, 59, 0.22)'

test('a blocked day is painted amber on its header, and an ordinary day is not', async ({ page }) => {
  const blocked = await page.locator('[data-testid="head-2026-03-10"]')
    .evaluate(el => getComputedStyle(el).backgroundColor)
  expect(blocked).toBe(BLOCKED_BG)

  const plain = await page.locator('[data-testid="head-2026-01-07"]')
    .evaluate(el => getComputedStyle(el).backgroundColor)
  expect(plain).not.toBe(BLOCKED_BG)
})

test('a blocked day that falls on a weekend still paints amber, not grey', async ({ page }) => {
  // 2026-03-14 is the Saturday inside the seed's exercise week: it carries
  // both `.blocked` and `.weekend`. jsdom-based unit tests can only prove
  // both classes were emitted, which was already true while the CSS cascade
  // bug was live — only a real browser computes which background wins.
  const head = page.locator('[data-testid="head-2026-03-14"]')
  expect(await head.evaluate(el => el.className)).toContain('blocked')
  expect(await head.evaluate(el => el.className)).toContain('weekend')
  const bg = await head.evaluate(el => getComputedStyle(el).backgroundColor)
  expect(bg).toBe(BLOCKED_BG)
})

// jsdom (the unit-test DOM) never computes an element's cascade, so it can
// prove the `.am`/`.pm` class landed on the right chip but not that the
// divider it triggers is actually painted — that only a real browser's
// `getComputedStyle(el, '::after')` can answer. Seed: ramp carries `*OIL`
// on 2026-02-10 (morning, half day), and OL on 2026-01-01 (whole day, no
// divider).
test('the half-day divider is painted on a half-day chip and absent on a whole-day chip', async ({ page }) => {
  const half = page.locator('[data-testid="cell-ramp-2026-02-10"] .c')
  const halfAfter = await half.evaluate(el => {
    const s = getComputedStyle(el, '::after')
    return { width: s.width, background: s.backgroundColor }
  })
  expect(parseFloat(halfAfter.width)).toBeGreaterThan(0)
  expect(halfAfter.background).not.toBe('rgba(0, 0, 0, 0)')

  // A whole-day chip carries no `::after` rule at all, so the browser
  // reports it with no generated box: `content: none` and a computed width
  // of `auto` rather than `0px` — `parseFloat('auto')` is `NaN`, not `0`, so
  // this checks the same "nothing painted" fact via content and background
  // instead of width.
  const whole = page.locator('[data-testid="cell-ramp-2026-01-01"] .c')
  const wholeAfter = await whole.evaluate(el => {
    const s = getComputedStyle(el, '::after')
    return { content: s.content, background: s.backgroundColor }
  })
  expect(wholeAfter.content).toBe('none')
  expect(wholeAfter.background).toBe('rgba(0, 0, 0, 0)')
})

test('the matrix stays within a sane DOM size', async ({ page }) => {
  // 16 people x 90 days plus counts and headers. Measured 2227 nodes on
  // 2026-08-09, before the Raptor restyle. The chip-span wrapper the
  // restyle adds around every populated cell's text pushed that to 2330
  // nodes, measured 2026-08-09 — still comfortably under the ceiling, which
  // stays at 2500 (headroom, not a target): raising it is a deliberate edit
  // in the PR that adds the nodes.
  //
  // The bidding plan left this figure untouched at 2330, measured again on
  // 2026-08-09: the bid sheet renders OUTSIDE the table, so `.mx *` cannot
  // see it. That is this selector's blind spot rather than a saving, which
  // is why the second half of this test counts the whole document with the
  // sheet open — a sheet that grew without bound would otherwise never
  // trouble the ceiling at all.
  const nodes = await page.evaluate(() => document.querySelectorAll('.mx *').length)
  // A missing `.mx` would make this 0, which is comfortably "less than the
  // ceiling" — assert it's also nonzero so an absent grid fails loudly
  // instead of passing by accident.
  expect(nodes).toBeGreaterThan(0)
  expect(nodes).toBeLessThan(2500)

  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await expect(page.locator('[data-testid="bid-picker"]')).toBeVisible()
  // 2384 whole-document nodes with the sheet open, measured 2026-08-09
  // (2330 of them the matrix). Ceiling 2600 on the same headroom principle.
  const all = await page.evaluate(() => document.querySelectorAll('*').length)
  expect(all).toBeGreaterThan(nodes)
  expect(all).toBeLessThan(2600)
})

test('the three bid states are three distinguishable colours', async ({ page }) => {
  const bg = (sel: string) => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundColor)
  const appr = await bg('[data-testid="cell-jaguar-2026-01-16"] .c')
  const tbc = await bg('[data-testid="cell-asics-2026-01-23"] .c')
  const ref = await bg('[data-testid="cell-jaguar-2026-01-19"] .c')
  expect(new Set([appr, tbc, ref]).size).toBe(3)
  for (const c of [appr, tbc, ref]) expect(c).not.toBe('rgba(0, 0, 0, 0)')
})

test('a bid can be placed and shows as pending', async ({ page }) => {
  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await page.locator('[data-testid="bid-LL"]').click()
  const cls = await page.locator('[data-testid="cell-dusk-2026-02-11"] .c').getAttribute('class')
  expect(cls).toContain('tbc')
})

// The reason the bid sheet is a fixed-position sheet rather than a popover
// inside the cell: `.mx-wrap` is an `overflow: auto` scroller, and anything
// positioned inside a 30px-wide cell is clipped by it. jsdom applies no
// layout at all, so the unit tests can prove the sheet was rendered and
// nothing whatever about whether it can be seen. Only a real browser can.
test('the bid sheet is visible in full, not clipped by the grid scroller', async ({ page }) => {
  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  const sheet = page.locator('[data-testid="bid-picker"]')
  await expect(sheet).toBeVisible()

  const box = (await sheet.boundingBox())!
  expect(box.width).toBeGreaterThan(0)
  expect(box.height).toBeGreaterThan(0)

  const view = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1)

  // Its buttons have to be reachable, not merely laid out — a sheet the
  // scroller clipped would still report a box while sitting under the grid.
  await expect(page.locator('[data-testid="bid-LL"]')).toBeVisible()
  await page.locator('[data-testid="bid-LL"]').click()
  await expect(sheet).toBeHidden()
})

test('opening the bid sheet never makes the page scroll sideways', async ({ page }) => {
  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await expect(page.locator('[data-testid="bid-picker"]')).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
