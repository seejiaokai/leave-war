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
  //
  // The counter column DOES sit inside `.mx` — one cell per person, one per
  // count row, plus the header and its two arrows — taking the figure to
  // 2357, measured 2026-08-09. That is one cell per row and cannot grow
  // with the number of counters, which is the point of a single cycling
  // column. Ceiling stays at 2500: still headroom, not a target.
  const nodes = await page.evaluate(() => document.querySelectorAll('.mx *').length)
  // A missing `.mx` would make this 0, which is comfortably "less than the
  // ceiling" — assert it's also nonzero so an absent grid fails loudly
  // instead of passing by accident.
  expect(nodes).toBeGreaterThan(0)
  expect(nodes).toBeLessThan(2500)

  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await expect(page.locator('[data-testid="bid-picker"]')).toBeVisible()
  // 2413 whole-document nodes with the sheet open, measured 2026-08-09
  // (2357 of them the matrix). Ceiling 2600 on the same headroom principle.
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

// A cell Raptor owns must be indistinguishable in COLOUR from an approved
// bid — the squadron's colour convention is that green means approved, and
// where the approval happened does not change that. Only a real browser
// computes which of the two rules on the chip actually won.
test('a cell Raptor owns is the same green as an approved bid', async ({ page }) => {
  const bg = (sel: string) => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundColor)
  const raptor = await bg('[data-testid="cell-tata-2026-01-09"] .c')
  const bid = await bg('[data-testid="cell-jaguar-2026-01-16"] .c')
  expect(raptor).toBe(bid)
  expect(raptor).not.toBe('rgba(0, 0, 0, 0)')
})

// ...and the mark that distinguishes it must actually be painted, rather
// than merely being a class jsdom can see. If this ever reads as damage on a
// real device the rule is meant to be deleted, so it is asserted as a
// deliberate decision and not left to rot unnoticed.
test('the Raptor mark is painted, and an ordinary bid carries none', async ({ page }) => {
  const edge = (sel: string) => page.locator(sel).evaluate(el => {
    const s = getComputedStyle(el)
    return { width: s.borderLeftWidth, style: s.borderLeftStyle }
  })
  const raptor = await edge('[data-testid="cell-tata-2026-01-09"] .c')
  expect(parseFloat(raptor.width)).toBeGreaterThan(0)
  expect(raptor.style).toBe('solid')

  const moved = await edge('[data-testid="cell-miles-2026-02-03"] .c')
  expect(parseFloat(moved.width)).toBeGreaterThan(0)
  expect(moved.style).toBe('dotted')

  const plain = await edge('[data-testid="cell-jaguar-2026-01-16"] .c')
  expect(parseFloat(plain.width) || 0).toBe(0)
})

test('a cell Raptor owns offers no way to change it', async ({ page }) => {
  await page.locator('[data-testid="cell-tata-2026-01-09"]').click()
  await expect(page.locator('[data-testid="raptor-sheet"]')).toBeVisible()
  await expect(page.locator('[data-testid="bid-LL"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="decide-approve"]')).toHaveCount(0)
})

// The workflow the owner described: closing the war makes the sheet
// view-only for the squadron, and the admin account keeps working.
test('closing the war locks the squadron out, and the admin account still edits', async ({ page }) => {
  await page.locator('[data-testid="stage-advance"]').click()
  await expect(page.locator('[data-testid="stage-now"]')).toHaveText('BIDDING CLOSED')

  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await expect(page.locator('[data-testid="bid-picker"]')).toHaveCount(0)

  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await expect(page.locator('[data-testid="bid-picker"]')).toBeVisible()
})

test('an admin moves a bid to another date, and it lands pending there', async ({ page }) => {
  await page.locator('[data-testid="stage-advance"]').click()
  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="cell-asics-2026-01-23"]').click()
  await page.locator('[data-testid="shift-date"]').fill('2026-01-30')
  await page.locator('[data-testid="decide-shift"]').click()

  await expect(page.locator('[data-testid="cell-asics-2026-01-23"] .c')).toHaveCount(0)
  const moved = page.locator('[data-testid="cell-asics-2026-01-30"] .c')
  await expect(moved).toBeVisible()
  expect(await moved.getAttribute('class')).toContain('tbc')
  expect(await moved.getAttribute('class')).toContain('moved')
})

// ---- the frozen counter column ----
//
// This is the riskiest surface in the build and the one jsdom is blindest
// to: a second sticky column anchors its `left:` to the first column's
// width, so a `.who` free to grow slides the two apart and leaves a gap the
// day cells scroll through. Every rectangle is 0×0 in the unit suite, so
// none of that is visible there.

test('both frozen columns stay put when the grid scrolls sideways', async ({ page }) => {
  const who = page.locator('[data-testid="row-ramp"] .who')
  const bal = page.locator('[data-testid="bal-ramp"]')
  const before = { who: (await who.boundingBox())!, bal: (await bal.boundingBox())! }

  const wrap = page.locator('.mx-wrap')
  await wrap.evaluate(el => el.scrollBy(600, 0))
  expect(await wrap.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)

  const after = { who: (await who.boundingBox())!, bal: (await bal.boundingBox())! }
  expect(Math.abs(after.who.x - before.who.x)).toBeLessThan(1)
  expect(Math.abs(after.bal.x - before.bal.x)).toBeLessThan(1)
})

test('the two frozen columns sit flush — no gap, no overlap', async ({ page }) => {
  const who = (await page.locator('[data-testid="row-ramp"] .who').boundingBox())!
  const bal = (await page.locator('[data-testid="bal-ramp"]').boundingBox())!
  // The balance column starts exactly where the callsign column ends. A gap
  // lets day cells scroll through between them; an overlap hides the name.
  expect(Math.abs(bal.x - (who.x + who.width))).toBeLessThan(1)
})

test('the balance column is opaque — day cells never show through it', async ({ page }) => {
  await page.locator('.mx-wrap').evaluate(el => el.scrollBy(600, 0))
  const bg = await page.locator('[data-testid="bal-ramp"]')
    .evaluate(el => getComputedStyle(el).backgroundColor)
  expect(bg).not.toBe('rgba(0, 0, 0, 0)')
})

// The space arithmetic, checked against a real browser rather than read off
// the stylesheet. The estimate that justified this design was WRONG — it
// assumed 30px day columns from `min-width`, where the rendered width is
// ~41px — so the figures below are measured, on 2026-08-09:
//
//   phone (390px viewport): wrap 348, callsign 76, balance 44 → 5.6 days
//   the same phone before the counter column: callsign 118    → 5.6 days
//
// The callsign column gives back almost exactly what the counter column
// takes, which was the whole point of tightening it. This test guards that
// trade rather than the individual numbers: a counter panel that left four
// days on screen would be a worse app than no counters at all.
test('the counter column does not eat the grid on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 })
  const m = await page.evaluate(() => {
    const wrap = document.querySelector('.mx-wrap')!.getBoundingClientRect().width
    const who = document.querySelector('[data-testid="row-ramp"] .who')!.getBoundingClientRect().width
    const bal = document.querySelector('[data-testid="bal-ramp"]')!.getBoundingClientRect().width
    const day = document.querySelector('[data-testid="cell-ramp-2026-01-15"]')!.getBoundingClientRect().width
    return { wrap, who, bal, day }
  })
  expect(m.day).toBeGreaterThan(0)
  const visibleDays = (m.wrap - m.who - m.bal) / m.day
  expect(visibleDays).toBeGreaterThan(5)
  // The frozen pair must stay a minority of a phone screen. Widening the
  // callsign column back to its desktop 118px would trip this.
  expect((m.who + m.bal) / m.wrap).toBeLessThan(0.4)
})

test('the counter column changes every row at once', async ({ page }) => {
  await expect(page.locator('[data-testid="counter-name"]')).toHaveText('ANNUAL')
  const rows = ['ramp', 'tata', 'jaguar', 'dusk']
  const before = await Promise.all(rows.map(r => page.locator(`[data-testid="bal-${r}"]`).textContent()))

  await page.locator('[data-testid="counter-next"]').click()
  await expect(page.locator('[data-testid="counter-name"]')).toHaveText('OIL')

  const after = await Promise.all(rows.map(r => page.locator(`[data-testid="bal-${r}"]`).textContent()))
  expect(after).not.toEqual(before)
  // Every row moved together — none is still showing the previous counter.
  for (const v of after) expect(v).not.toBeNull()
})

test('a negative balance is painted red, and a positive one is not', async ({ page }) => {
  // DECAL's OIL opens at -4.5 and nothing in the seed moves it.
  await page.locator('[data-testid="counter-next"]').click()
  await expect(page.locator('[data-testid="counter-name"]')).toHaveText('OIL')
  const neg = await page.locator('[data-testid="bal-decal"]').evaluate(el => ({
    text: el.textContent, colour: getComputedStyle(el).color,
  }))
  expect(neg.text).toBe('-4.5')
  const pos = await page.locator('[data-testid="bal-ramp"]')
    .evaluate(el => getComputedStyle(el).color)
  expect(neg.colour).not.toBe(pos)
})

// Nothing in the frozen column may be cut off. `.who` carries `overflow:
// hidden` — without it a long label would push the balance column out of
// alignment — so an oversized label fails SILENTLY, appearing merely
// truncated. jsdom reports every width as 0 and cannot see it at all.
//
// This caught two real cases when the phone breakpoint tightened the column
// to 76px: "Crew sets" wanted 84px against 75 available, and "IP + IWSO" 77.
// Both are count-row labels; every callsign still fitted, which is why the
// bug was invisible until it was measured.
test('nothing in the callsign column is cut off', async ({ page }) => {
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.mx .who')]
      .map(el => el as HTMLElement)
      .filter(el => el.scrollWidth > el.clientWidth + 1)
      .map(el => `${el.textContent?.trim()} (${el.scrollWidth} > ${el.clientWidth})`))
  expect(clipped).toEqual([])

  // Proves the collection was not empty, so an absent `.who` cannot pass
  // this by having nothing to check.
  const count = await page.locator('.mx .who').count()
  expect(count).toBeGreaterThan(10)
})
