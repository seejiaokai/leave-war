import { expect, test, type Page } from '@playwright/test'

const CAL_MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

/** Choose a counter through the sheet. The whole column header is the
 *  control — the two arrows it replaced were 13px glyphs the owner could not
 *  hit on a phone. */
async function pickCounter(page: Page, counter: string) {
  await page.locator('[data-testid="counter-pick"]').click()
  await page.locator(`[data-testid="counter-${counter}"]`).click()
}

/** A horizontal swipe, dispatched as real `Touch` objects. Playwright's
 *  `touchscreen` taps but cannot drag, and `TouchEventInit` rejects plain
 *  objects — it needs actual `Touch` instances. */
async function swipe(page: Page, from: { x: number; y: number }, dx: number) {
  await page.evaluate(([x, y, delta]) => {
    const el = document.elementFromPoint(x, y)!
    const at = (cx: number) => [new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })]
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: at(x) }))
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: at(x + delta) }))
  }, [from.x, from.y, dx])
}

/** Drive a range calendar to a span the way a person does — walk to the
 *  month, tap the start, walk on, tap the end. */
async function pickSpan(page: Page, testid: string, from: string, to: string) {
  const goTo = async (yyyymm: string) => {
    for (let i = 0; i < 72; i++) {
      const shown = (await page.locator(`[data-testid="${testid}-month"]`).textContent())!
      const [name, year] = shown.split(' ')
      const at = `${year}-${String(CAL_MONTHS.indexOf(name) + 1).padStart(2, '0')}`
      if (at === yyyymm) return
      await page.locator(`[data-testid="${testid}-${at < yyyymm ? 'next' : 'prev'}-month"]`).click()
    }
    throw new Error(`never reached ${yyyymm}`)
  }
  await goTo(from.slice(0, 7))
  await page.locator(`[data-testid="${testid}-day-${from}"]`).click()
  await goTo(to.slice(0, 7))
  await page.locator(`[data-testid="${testid}-day-${to}"]`).click()
}


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
  // column.
  //
  // THE CEILING WAS THEN RAISED FROM 2500 TO 9600, DELIBERATELY. The war is
  // now a whole year rather than a quarter, because that is how the owner
  // reads it — so the same grid is 365 columns instead of 90 and the node
  // count is four times what it was. Measured 2026-08-10 BEFORE writing the
  // number here, on both projects: 9241 inside `.mx`, 9278 whole-document
  // with a sheet open, and a load of 687-757ms with a bid round-trip of
  // 296-355ms. That cost was measured first and the year adopted second;
  // had it come out at seconds, the year would not have shipped.
  //
  // Raised again, 9600 -> 9900, when every date header gained a weekday
  // label. That is 365 more spans and takes the measured figure to 9607, and
  // it is worth the nodes: a year of columns numbered 01…31 twelve times
  // over gives the eye nothing to hold on to.
  //
  // The headroom principle is unchanged: this is a ceiling, not a target,
  // and raising it is a deliberate edit in the change that adds the nodes.
  const nodes = await page.evaluate(() => document.querySelectorAll('.mx *').length)
  // A missing `.mx` would make this 0, which is comfortably "less than the
  // ceiling" — assert it's also nonzero so an absent grid fails loudly
  // instead of passing by accident. The lower bound is a real floor too: a
  // grid that quietly went back to a quarter would sit near 2357 and this
  // would catch it.
  expect(nodes).toBeGreaterThan(8000)
  expect(nodes).toBeLessThan(9900)

  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await expect(page.locator('[data-testid="bid-picker"]')).toBeVisible()
  // 9644 whole-document nodes with the sheet open (9607 of them the matrix),
  // measured 2026-08-10 after the weekday labels landed. Ceiling 10000 on
  // the same principle. The gap between
  // the two figures is the app chrome and the sheet — about 37 nodes — and
  // it is the sheet's unbounded growth this half of the test watches.
  const all = await page.evaluate(() => document.querySelectorAll('*').length)
  expect(all).toBeGreaterThan(nodes)
  expect(all).toBeLessThan(10000)
})

// A year is ~13,600px of grid. Reaching September by dragging is not a thing
// anybody will do, so the month strip is what makes a year-long war usable at
// all — which makes it load-bearing, not decoration. jsdom computes no layout
// and cannot scroll, so the unit tests prove the arithmetic against stated
// rectangles and NOTHING about whether the grid actually moves. Only here.
test('a month button scrolls the grid to that month', async ({ page }) => {
  const wrap = page.locator('.mx-wrap')
  expect(await wrap.evaluate(el => el.scrollLeft)).toBe(0)

  await page.locator('[data-testid="month-SEP"]').click()
  const scrolled = await wrap.evaluate(el => el.scrollLeft)
  expect(scrolled).toBeGreaterThan(5000)

  // Landing near the month is not enough: the day has to be ON SCREEN and
  // clear of the two frozen columns, which are painted OVER the day cells.
  // A jump that forgot their width would put 1 September underneath the
  // callsign column, where it is scrolled-to and invisible at the same time.
  const head = (await page.locator('[data-testid="head-2026-09-01"]').boundingBox())!
  const bal = (await page.locator('.mx thead th.bal').boundingBox())!
  expect(head.x).toBeGreaterThanOrEqual(bal.x + bal.width - 1)
  const wrapBox = (await wrap.boundingBox())!
  expect(head.x + head.width).toBeLessThanOrEqual(wrapBox.x + wrapBox.width + 1)
})

// Pressing a second month from wherever the first one left the grid is the
// ordinary way this gets used, and it is the case an absolute `scrollLeft =`
// gets wrong once the grid is already scrolled.
test('a month button works from wherever the grid already is', async ({ page }) => {
  await page.locator('[data-testid="month-SEP"]').click()
  const atSep = await page.locator('.mx-wrap').evaluate(el => el.scrollLeft)
  await page.locator('[data-testid="month-MAR"]').click()
  const atMar = await page.locator('.mx-wrap').evaluate(el => el.scrollLeft)
  expect(atMar).toBeLessThan(atSep)

  const head = (await page.locator('[data-testid="head-2026-03-01"]').boundingBox())!
  const bal = (await page.locator('.mx thead th.bal').boundingBox())!
  expect(head.x).toBeGreaterThanOrEqual(bal.x + bal.width - 1)
})

// The strip has to be reachable on a phone without itself becoming a
// scrolling problem — twelve buttons that ran off the right edge would just
// move the navigation problem up one level.
test('the whole month strip is on screen at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 })
  const strip = page.locator('[data-testid="month-strip"]')
  await expect(strip).toBeVisible()
  const overflows = await strip.evaluate(el => el.scrollWidth > el.clientWidth + 1)
  expect(overflows).toBe(false)
  for (const m of ['JAN', 'JUN', 'DEC']) {
    const box = (await page.locator(`[data-testid="month-${m}"]`).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
  }
})

// The owner's colour rule, restated 10 Aug 26: a bid nobody has answered
// carries no colour at all, purple means management has acknowledged it,
// green approved, red refused. jsdom can prove which class was emitted and
// nothing about what was painted — only a browser computes the cascade.
test('the four bid states read as three colours and one plain cell', async ({ page }) => {
  const bg = (sel: string) => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundColor)
  const appr = await bg('[data-testid="cell-jaguar-2026-01-16"] .c')
  const ack = await bg('[data-testid="cell-asics-2026-02-24"] .c')
  const ref = await bg('[data-testid="cell-jaguar-2026-01-19"] .c')
  expect(new Set([appr, ack, ref]).size).toBe(3)
  for (const c of [appr, ack, ref]) expect(c).not.toBe('rgba(0, 0, 0, 0)')

  // Pending is the absence of news, so it must be the absence of paint —
  // asserted against all three answered colours, not merely "not purple".
  const pending = await bg('[data-testid="cell-asics-2026-01-23"] .c')
  expect(pending).toBe('rgba(0, 0, 0, 0)')
  for (const c of [appr, ack, ref]) expect(pending).not.toBe(c)

  // Plain must still be READABLE. A cell with no background is only correct
  // if its text keeps the ordinary ink — an invisible bid would be worse
  // than a wrongly coloured one.
  const ink = await page.locator('[data-testid="cell-asics-2026-01-23"] .c')
    .evaluate(el => getComputedStyle(el).color)
  const body = await page.evaluate(() => getComputedStyle(document.body).color)
  expect(ink).toBe(body)
})

// A bid lands PENDING, which since 10 Aug 26 means plain — no colour class
// at all. It used to assert `tbc`, which is now the acknowledged colour: the
// squadron must be able to tell a bid nobody has looked at from one already
// in management's hands, and a freshly typed bid is the former.
test('a bid can be placed, and lands plain because nobody has answered it', async ({ page }) => {
  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await page.locator('[data-testid="bid-LL"]').click()
  const chip = page.locator('[data-testid="cell-dusk-2026-02-11"] .c')
  await expect(chip).toBeVisible()
  const cls = (await chip.getAttribute('class'))!
  for (const painted of ['tbc', 'appr', 'ref']) expect(cls).not.toContain(painted)
  expect(await chip.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
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
  // A shift lands PENDING — a move is a proposal, and someone still has to
  // approve the date it moved to — so the chip is plain, not purple. The
  // dotted `moved` edge is what says it was shifted, and it sits on top of
  // whatever state colour there is or is not.
  const cls = (await moved.getAttribute('class'))!
  for (const painted of ['tbc', 'appr', 'ref']) expect(cls).not.toContain(painted)
  expect(cls).toContain('moved')
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

// This test USED to assert only `not rgba(0, 0, 0, 0)`, and that is exactly
// how it let a real defect through: the row-hover rule repainted the frozen
// cell `rgba(59, 198, 232, 0.05)`, which is not transparent and is not opaque
// either, so the grid scrolled visibly underneath it while this passed. The
// owner found it on a phone. "Not transparent" was never the requirement —
// FULLY opaque is, so alpha is what gets asserted now.
//
// The hovered case is the one that broke, and it is not an exotic state on a
// touch screen: a tap leaves the row hovered until something else is tapped,
// so on a phone the column stays see-through for as long as you look at it.
test('the balance column is opaque — day cells never show through it', async ({ page }) => {
  const bal = page.locator('[data-testid="bal-ramp"]')
  const alphaOf = (css: string) => {
    const parts = css.match(/[\d.]+/g)!
    return parts.length < 4 ? 1 : Number(parts[3])
  }

  await page.locator('.mx-wrap').evaluate(el => el.scrollBy(600, 0))
  const day = page.locator('[data-testid="cell-ramp-2026-01-15"]')
  // A cell in the SAME ROW that the pointer will not be on. Asserting the
  // row lights up needs a cell the pointer is not touching: the hovered one
  // changes colour anyway through `.mx td.act:hover`, so it cannot tell
  // "the row lights up" from "the cell does".
  const sibling = page.locator('[data-testid="cell-ramp-2026-01-16"]')
  const who = page.locator('[data-testid="row-ramp"] .who')
  const bg = (l: typeof day) => l.evaluate(el => getComputedStyle(el).backgroundColor)

  // Every at-rest reading is taken BEFORE anything is hovered. Taking them
  // after a hover was a real mistake in this test's first draft: the row was
  // already lit, so "at rest" and "hovered" were the same measurement and
  // the comparison could only ever be false.
  const balAtRest = await bg(bal)
  const siblingAtRest = await bg(sibling)
  expect(alphaOf(balAtRest)).toBe(1)

  await day.hover()

  // The defect: opaque at rest, opaque hovered. Nothing shows through.
  expect(alphaOf(await bg(bal))).toBe(1)
  // The callsign column was always exempt; assert it stays that way.
  expect(alphaOf(await bg(who))).toBe(1)
  // ...and the row hover this rule exists for still happens, so a "fix" that
  // simply deleted the rule does not pass. `alpha < 1` would not do here
  // either: an untinted cell is transparent, which is translucent too.
  expect(await bg(sibling)).not.toBe(siblingAtRest)
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

  await pickCounter(page, 'oil')
  await expect(page.locator('[data-testid="counter-name"]')).toHaveText('OIL')

  const after = await Promise.all(rows.map(r => page.locator(`[data-testid="bal-${r}"]`).textContent()))
  expect(after).not.toEqual(before)
  // Every row moved together — none is still showing the previous counter.
  for (const v of after) expect(v).not.toBeNull()
})

test('a negative balance is painted red, and a positive one is not', async ({ page }) => {
  // DECAL's OIL opens at -4.5 and nothing in the seed moves it.
  await pickCounter(page, 'oil')
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

// ---- more than one leave war ----

test('switching leave war repaints the grid and keeps the balance', async ({ page }) => {
  await expect(page.locator('[data-testid="cell-ramp-2026-01-01"]')).toHaveText('OL')
  const before = await page.locator('[data-testid="bal-reset"]').textContent()

  await page.selectOption('[data-testid="war-picker"]', { label: 'JAN - DEC 27' })
  await expect(page.locator('[data-testid="cell-reset-2027-04-13"]')).toHaveText('LL')
  await expect(page.locator('[data-testid="cell-ramp-2026-01-01"]')).toHaveCount(0)

  // Entitlements are continuous and wars are windows onto them, so the
  // figure is the same from either screen. RESET's four days sit in Apr–Jun
  // and take him to −2 annual, which reads −2 from Jan–Mar too.
  await expect(page.locator('[data-testid="bal-reset"]')).toHaveText(before!)
  expect(before).toBe('-2')
})

// The create sheet renders OUTSIDE `.topbar` because that element carries
// `backdrop-filter`, which makes it the containing block for any
// `position: fixed` descendant — the sheet would otherwise resolve its
// `bottom` against a 60px-tall bar and appear clipped at the top of the
// page. Every unit test passed while it was broken: jsdom computes no
// layout at all. This is the test that caught it.
test('the new-leave-war sheet is anchored to the viewport, not the topbar', async ({ page }) => {
  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="war-new"]').click()

  const sheet = page.locator('[data-testid="war-sheet"]')
  await expect(sheet).toBeVisible()

  const box = (await sheet.boundingBox())!
  const view = page.viewportSize()!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1)
  // Anchored to the BOTTOM, which is where every other sheet sits and where a
  // thumb already is on a phone. Asserted on the sheet's bottom edge rather
  // than its top: once this sheet gained a month calendar it became tall
  // enough to reach well up the screen, and "its top is in the lower half"
  // stopped being a statement about anchoring at all.
  expect(view.height - (box.y + box.height)).toBeLessThan(40)

  const bar = (await page.locator('.topbar').boundingBox())!
  expect(box.y).toBeGreaterThan(bar.y + bar.height)
})

// A single month, deliberately: the owner settled that a period is any range
// they choose, down to one month, and this is the short end of that. The
// dates are in 2028 because the two seeded wars now cover the whole of 2026
// and 2027 — with year-long wars there is no free month any nearer.
test('an admin creates a leave war, and it joins the picker', async ({ page }) => {
  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="war-new"]').click()
  await page.fill('[data-testid="war-name"]', 'JUL 28')
  await pickSpan(page, 'war', '2028-07-01', '2028-07-31')
  await page.locator('[data-testid="war-create"]').click()

  await expect(page.locator('[data-testid="war-sheet"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="war-picker"] option')).toHaveText([
    'JAN - DEC 26', 'JAN - DEC 27', 'JUL 28',
  ])
})

test('overlapping dates are refused, with the reason on screen', async ({ page }) => {
  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="war-new"]').click()
  await page.fill('[data-testid="war-name"]', 'CLASH')
  await pickSpan(page, 'war', '2026-05-01', '2026-08-31')
  await page.locator('[data-testid="war-create"]').click()

  await expect(page.locator('[data-testid="war-problem"]')).toBeVisible()
  await expect(page.locator('[data-testid="war-sheet"]')).toBeVisible()
  await expect(page.locator('[data-testid="war-picker"] option')).toHaveCount(2)
})

// The bidding window is the answer to the owner's "the admin can select which
// period to open" now that a war is a whole year. jsdom proves the class is
// emitted and nothing about whether a locked column LOOKS locked, which is the
// only thing that matters to someone holding a phone.
test('a locked column is visibly dimmer than an open one, and still readable', async ({ page }) => {
  const open = page.locator('[data-testid="head-2026-02-11"]')
  const locked = page.locator('[data-testid="head-2026-08-11"]')
  const opacity = (l: typeof open) => l.evaluate(el => Number(getComputedStyle(el).opacity))

  expect(await opacity(open)).toBe(1)
  const dim = await opacity(locked)
  expect(dim).toBeLessThan(1)
  // Dimmed, not hidden. Seeing the rest of the year is the entire reason the
  // war is a year — a lock that erased October would undo that.
  expect(dim).toBeGreaterThan(0.25)
  await expect(locked).toBeVisible()
  expect((await locked.boundingBox())!.width).toBeGreaterThan(0)
})

test('an admin sees no lock, because the window does not bind them', async ({ page }) => {
  await page.locator('[data-testid="role-toggle"]').click()
  const locked = page.locator('[data-testid="head-2026-08-11"]')
  expect(await locked.evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1)
})

// The range calendar is the control the owner asked for twice — for leave and
// for a war's dates. Its whole justification over two native date inputs is
// that it DRAWS the span, and only a browser can say whether it does.
test('the range calendar paints the span between the two taps', async ({ page }) => {
  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="bid-window"]').click()
  await expect(page.locator('[data-testid="window-sheet"]')).toBeVisible()

  const bg = (d: string) => page.locator(`[data-testid="window-day-${d}"]`)
    .evaluate(el => getComputedStyle(el).backgroundColor)
  // Cleared first, because the sheet opens showing the window that is already
  // set — Jan-Mar — so every January day starts painted and there would be no
  // unpainted day left to compare against.
  await page.locator('[data-testid="window-clear"]').click()
  const plain = await bg('2026-01-20')

  await page.locator('[data-testid="window-day-2026-01-12"]').click()
  await page.locator('[data-testid="window-day-2026-01-16"]').click()

  // Every day in the span is painted, the ends more strongly than the middle,
  // and a day outside it is untouched.
  const middle = await bg('2026-01-14')
  const start = await bg('2026-01-12')
  expect(middle).not.toBe(plain)
  expect(start).not.toBe(middle)
  expect(await bg('2026-01-20')).toBe(plain)
})

// The owner's complaint about the counter arrows was that they are too small
// to hit. The calendar is the control that mistake taught, so its days and its
// month arrows are held to a real tap target on a phone.
test('every control in the range calendar is a real tap target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 })
  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="bid-window"]').click()

  for (const id of ['window-day-2026-01-12', 'window-prev-month', 'window-next-month']) {
    const box = (await page.locator(`[data-testid="${id}"]`).boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(30)
    expect(box.height).toBeGreaterThanOrEqual(30)
  }
})

// Same trap the new-war sheet fell into: `.topbar` carries `backdrop-filter`,
// which makes it the containing block for any `position: fixed` descendant.
// This sheet opens from the stage strip, so it has to be checked separately.
test('the bidding-window sheet is anchored to the viewport, not clipped', async ({ page }) => {
  await page.locator('[data-testid="role-toggle"]').click()
  await page.locator('[data-testid="bid-window"]').click()
  const sheet = page.locator('[data-testid="window-sheet"]')
  await expect(sheet).toBeVisible()

  const box = (await sheet.boundingBox())!
  const view = page.viewportSize()!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1)
  const bar = (await page.locator('.topbar').boundingBox())!
  expect(box.y).toBeGreaterThan(bar.y + bar.height)
})

// A posted-out day is drawn as shaded grey diagonal lines — the owner asked
// for it on 10 Aug 26, which is how we learned the hatch already there was
// too faint to read on a phone. jsdom cannot see a gradient at all, so the
// unit suite can only prove the `.gone` class was emitted.
test('a posted-out cell is hatched, and an ordinary cell is not', async ({ page }) => {
  const bgImage = (d: string) => page.locator(`[data-testid="cell-switcher-${d}"]`)
    .evaluate(el => getComputedStyle(el).backgroundImage)

  // SWITCHER is posted out on 2026-01-12, so the 13th is the first day gone.
  const gone = await bgImage('2026-01-13')
  expect(gone).toContain('repeating-linear-gradient')
  expect(await bgImage('2026-01-09')).toBe('none')

  // The hatch has to be visible against the cell it sits on, not a shade of
  // the background. Taken as the STRONGEST stop in the gradient, not the
  // first: `transparent` computes to `rgba(0, 0, 0, 0)` and leads the list,
  // so reading stop one measured the gaps between the lines rather than the
  // lines. Found by this test failing against a hatch that was in fact fine.
  const alphas = [...gone.matchAll(/rgba\([\d\s,]+?,\s*([\d.]+)\)/g)].map(m => Number(m[1]))
  expect(Math.max(...alphas)).toBeGreaterThanOrEqual(0.6)
})

// OFF is free leave (owner, 10 Aug 26): the person is gone from the manning
// picture and no entitlement is spent. It has to be offered like any other
// leave, or it cannot be asked for at all.
test('OFF can be bid, takes the day, and moves no balance', async ({ page }) => {
  const balance = () => page.locator('[data-testid="bal-dusk"]').textContent()
  const count = () => page.locator('[data-testid="count-opsw-2026-02-11"]').textContent()
  const before = { bal: await balance(), manning: await count() }

  await page.locator('[data-testid="cell-dusk-2026-02-11"]').click()
  await page.locator('[data-testid="bid-OFF"]').click()

  await expect(page.locator('[data-testid="cell-dusk-2026-02-11"] .c')).toHaveText('OFF')
  // The man is gone from the count...
  expect(await count()).not.toBe(before.manning)
  // ...and his annual balance has not moved, because OFF spends nothing.
  expect(await balance()).toBe(before.bal)
})

// The owner's complaint, from a phone: the chrome ate the screen and left
// four rows of grid visible. Two things had to change — the topbar scrolls
// away, and there is less of it to scroll past — and neither is visible to
// jsdom, which computes no layout at all.
test('the topbar scrolls away instead of holding the top of the screen', async ({ page }) => {
  // A SHORT viewport on purpose. At 390x760 the whole page is now only 808px
  // tall — the chrome shrank enough that there is barely anything to scroll,
  // which is the change working but leaves nothing for this test to observe.
  // 390x400 guarantees the page genuinely scrolls, so "does the topbar move
  // with it" is a question that can be asked at all.
  await page.setViewportSize({ width: 390, height: 400 })
  const bar = page.locator('.topbar')
  const before = (await bar.boundingBox())!
  expect(before.y).toBeGreaterThanOrEqual(0)

  await page.evaluate(() => window.scrollBy(0, 200))
  // Prove the page genuinely scrolled before trusting the topbar's new
  // position as evidence of anything.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100)

  const after = await bar.boundingBox()
  // Either gone entirely or moved up with the page — what it must NOT do is
  // stay where it was, which is what `position: sticky` made it do.
  expect(after === null || after.y < before.y - 100).toBe(true)
})

// The other half of the owner's complaint, and the more important half: not
// how the chrome behaves when scrolled, but how much of it there is. Measured
// at 390x760 before the change — the title, the picker, the stage strip and
// the month strip held 690px of a 760px screen.
test('the chrome above the grid is a fraction of the screen, not most of it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  const wrap = (await page.locator('.mx-wrap').boundingBox())!
  // Everything above the first date column: topbar, stage strip, card header
  // and month strip together.
  expect(wrap.y).toBeLessThan(320)
})

// Scrolling the chrome away is only worth doing if the date header does not
// go with it. That row is the one part of the top of this page that is
// load-bearing while reading a grid.
test('the date header stays put while the topbar goes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 400 })
  await page.evaluate(() => window.scrollBy(0, 200))
  const head = page.locator('[data-testid="head-2026-01-15"]')
  await expect(head).toBeVisible()
  const box = (await head.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeLessThan(760)
})

// The measurement behind the change: at 390x760 the chrome held 690px and
// left four rows of grid. This pins the improvement as a number rather than
// as a claim.
test('the grid gets most of the screen on a phone once the chrome is scrolled away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  await page.evaluate(() => window.scrollBy(0, 2000))

  const rows = await page.evaluate(() => {
    const seen = [...document.querySelectorAll('.mx tbody tr')]
    return seen.filter(r => {
      const b = r.getBoundingClientRect()
      return b.top >= 0 && b.bottom <= window.innerHeight && b.height > 0
    }).length
  })
  // Four rows was the complaint. Twelve of the sixteen aircrew is the answer.
  expect(rows).toBeGreaterThanOrEqual(12)
})

test('every date column names its weekday', async ({ page }) => {
  const dow = (d: string) => page.locator(`[data-testid="head-${d}"] .dow`).textContent()
  expect(await dow('2026-01-05')).toBe('MON')
  expect(await dow('2026-01-11')).toBe('SUN')
  // Legible, not merely present: it is the smallest text in the grid.
  const size = await page.locator('[data-testid="head-2026-01-05"] .dow')
    .evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(8)
})

// The owner's complaint: "The left and right buttons on the phone to toggle
// the view for the leave counter is too small." They were — two 13px glyphs
// inside a 44px column. This is the size question, and only a browser can
// answer it.
test('the counter control is a real tap target on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  const head = (await page.locator('[data-testid="counter-pick"]').boundingBox())!
  // The whole column header is the button now, so it is as wide as the
  // column and tall enough to hit without aiming.
  expect(head.width).toBeGreaterThanOrEqual(36)
  expect(head.height).toBeGreaterThanOrEqual(36)

  await page.locator('[data-testid="counter-pick"]').click()
  await expect(page.locator('[data-testid="counter-sheet"]')).toBeVisible()
  // And every row in the sheet clears the 44px a thumb needs.
  for (const c of ['annual', 'oil', 'el']) {
    const row = (await page.locator(`[data-testid="counter-${c}"]`).boundingBox())!
    expect(row.height).toBeGreaterThanOrEqual(44)
    expect(row.width).toBeGreaterThanOrEqual(240)
  }
})

test('the counter sheet changes the column, and every row with it', async ({ page }) => {
  const shown = () => page.locator('[data-testid="counter-name"]').textContent()
  expect(await shown()).toBe('ANNUAL')
  const before = await page.locator('[data-testid="bal-ramp"]').textContent()

  await page.locator('[data-testid="counter-pick"]').click()
  await page.locator('[data-testid="counter-oil"]').click()

  expect(await shown()).toBe('OIL')
  await expect(page.locator('[data-testid="counter-sheet"]')).toHaveCount(0)
  expect(await page.locator('[data-testid="bal-ramp"]').textContent()).not.toBe(before)
})

// The fast path beside the sheet's guaranteed one. Touch emulation is only
// available on the phone project, so this is skipped elsewhere rather than
// pretended.
test('swiping across the counter column cycles it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'needs touch emulation')
  const shown = () => page.locator('[data-testid="counter-name"]').textContent()
  expect(await shown()).toBe('ANNUAL')

  const bal = (await page.locator('[data-testid="bal-ramp"]').boundingBox())!
  const at = { x: bal.x + bal.width / 2, y: bal.y + bal.height / 2 }

  // Right to left is "next", the direction a page turns.
  await swipe(page, at, -90)
  expect(await shown()).toBe('OIL')
  await swipe(page, at, 90)
  expect(await shown()).toBe('ANNUAL')
})

// Short and vertical drags must NOT cycle it, or the counter would flip
// whenever somebody scrolled the rows under their thumb.
test('a small or vertical drag on the counter column changes nothing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'needs touch emulation')
  const bal = (await page.locator('[data-testid="bal-ramp"]').boundingBox())!
  const at = { x: bal.x + bal.width / 2, y: bal.y + bal.height / 2 }
  await swipe(page, at, -20)
  expect(await page.locator('[data-testid="counter-name"]').textContent()).toBe('ANNUAL')
})

// A swipe that starts anywhere else must go on scrolling the grid. A counter
// that flipped whenever someone dragged the year sideways would be worse than
// no swipe at all.
test('swiping the day columns leaves the counter alone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'needs touch emulation')
  // A day column that is actually ON SCREEN at 390px. The 15th sits ~736px
  // along an unscrolled year, so `elementFromPoint` would land on whatever
  // is at that coordinate in the viewport — which is the frozen counter
  // column, and the test would then be swiping the very thing it means to
  // avoid. Found by this test failing for that reason.
  const cell = (await page.locator('[data-testid="cell-ramp-2026-01-03"]').boundingBox())!
  expect(cell.x).toBeLessThan(390)
  await swipe(page, { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }, -120)
  expect(await page.locator('[data-testid="counter-name"]').textContent()).toBe('ANNUAL')
})
