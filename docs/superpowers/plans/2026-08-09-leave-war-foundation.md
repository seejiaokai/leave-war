# LEAVE WAR — Foundation, Roster, Matrix and Rules Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a squadron's leave war as a scrollable matrix with live, fractional manning counts that turn amber and red against editable rules.

**Architecture:** A DOM-free rules engine (`src/engine/`) holds every rule and every sum so it can be tested headlessly and later lifted into RAPTOR. A small store (`src/state/`) sits above it with storage behind one swappable seam. React components (`src/ui/`) render the matrix on top. Nothing in `src/engine/` may import React or touch `document`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (unit + component), Playwright (real-browser geometry), all matching RAPTOR so the eventual merge is a move rather than a rewrite.

**Spec:** `docs/superpowers/specs/2026-08-09-leave-war-design.md`

## Global Constraints

Every task's requirements implicitly include these.

- **Availability is fractional.** A half-day code removes 0.5 of a person, never 1.0. This is the single largest behavioural difference from the spreadsheet being replaced.
- **Warn, never block.** No rule in this codebase ever refuses an entry. Rules produce verdicts; humans decide.
- **`src/engine/` is DOM-free.** No React import, no `document`, no `window`. It must run under plain Node.
- **Codes and rules are data, not code.** Adding a leave code or a manning rule is a configuration change.
- **Dates are `yyyy-mm-dd` strings everywhere.** Never a `Date` object in a model or a prop. Parse with `Date.UTC` and read with `getUTC*` accessors only — local-time accessors shift the day across timezones.
- **Colours are fixed by squadron convention:** magenta `#FF00FF` bid pending, green `#66FF33` approved, red `#FF0000` refused, yellow `#FFFF00` SC duty earning OIL, orange `#FFA500` blocked day header. Amber `#FFBF00` and red `#FF0000` for manning verdicts.
- **Every bug fix lands with a test that pins it.** Never weaken a failing assertion.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` and `npm run build` for every later task

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "leave-war",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^3.0.0"
  }
}
```

Vitest must be `^3` or later alongside Vite 6. The whole 2.1.x line carries
Vite `^5` as a hard dependency rather than a peer, so the two resolve to
different Vite copies and `tsc -b` fails on a plugin type conflict.

- [ ] **Step 2: Create the TypeScript and Vite configs**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`e2e/` is deliberately outside this project. Playwright exports its own `test`
and `expect`, and Vitest's globals are declared here — including both in one
program makes those two names collide.

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts` — `base: './'` matters: it is what lets the built bundle work under a GitHub Pages sub-path as well as at a preview root. The config comes from `vitest/config`, not `vite`: Vite's own `defineConfig` does not type the `test` block and will reject it.

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Run the whole suite somewhere local time and UTC genuinely disagree.
    // On a UTC machine — this container, and most CI runners — a date routine
    // written with local accessors behaves identically to a correct one, so
    // the tests that exist to catch that mistake cannot catch it. Pacific/
    // Midway is UTC-11, so a UTC Saturday is a local Friday and the two
    // readings diverge.
    env: { TZ: 'Pacific/Midway' },
  },
})
```

- [ ] **Step 3: Create `index.html` and `src/main.tsx`**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LEAVE WAR</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <h1>LEAVE WAR</h1>
  </StrictMode>,
)
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
test-results/
playwright-report/
*.local
*.tsbuildinfo
.superpowers/
```

`*.tsbuildinfo` because the `build` script runs `tsc -b`, which writes a cache
file per project to the repo root. `.superpowers/` because that is the
subagent workspace — briefs, reports and the progress ledger — and it is
scratch, never source.

- [ ] **Step 5: Write the scaffold test**

`src/scaffold.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('scaffold', () => {
  it('runs the test suite', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Install and verify**

Run: `npm install && npm test && npm run build`
Expected: install succeeds, one test passes, build emits `dist/` with no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript + Vitest"
```

---

### Task 2: The day-code catalogue

**Files:**
- Create: `src/engine/codes.ts`
- Test: `src/engine/codes.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `CounterName`, `DayCode`, `CODES`, `codeOf(code)`, `isDuty(code)`

Every code carries four facts, replacing the spreadsheet's "any text means gone". `removes` is how much of the day the person is unavailable for; `spends` names the counter drawn down; `earnsOil` is what duty credits; `bid` is whether a person bids for it at all; `duty` marks someone at work but off the flying programme.

- [ ] **Step 1: Write the failing test**

`src/engine/codes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CODES, codeOf, isDuty } from './codes'

describe('day codes', () => {
  it('makes a half day cost half a person, not a whole one', () => {
    expect(codeOf('AM')!.removes).toBe(0.5)
    expect(codeOf('PM')!.removes).toBe(0.5)
    expect(codeOf('HO')!.removes).toBe(0.5)
    expect(codeOf('LL')!.removes).toBe(1)
  })

  it('spends the right counter', () => {
    expect(codeOf('LL')!.spends).toEqual({ counter: 'annual', amount: 1 })
    expect(codeOf('AM')!.spends).toEqual({ counter: 'annual', amount: 0.5 })
    expect(codeOf('HO')!.spends).toEqual({ counter: 'oil', amount: 0.5 })
    expect(codeOf('EL')!.spends).toEqual({ counter: 'el', amount: 1 })
  })

  it('spends nothing for medical, courses and overseas duty', () => {
    for (const c of ['M', 'HL', 'CSE', 'OD']) expect(codeOf(c)!.spends).toBeNull()
  })

  it('earns OIL only for SC duty', () => {
    expect(codeOf('FS')!.earnsOil).toBe(1)
    expect(codeOf('HS')!.earnsOil).toBe(0.5)
    expect(codeOf('LL')!.earnsOil).toBe(0)
  })

  it('marks SC duty as duty and never as a bid', () => {
    expect(isDuty('FS')).toBe(true)
    expect(isDuty('HS')).toBe(true)
    expect(isDuty('LL')).toBe(false)
    expect(codeOf('FS')!.bid).toBe(false)
    expect(codeOf('LL')!.bid).toBe(true)
  })

  it('does not treat medical, courses or duty as bids', () => {
    for (const c of ['M', 'HL', 'CSE', 'OD', 'FS', 'HS']) {
      expect(codeOf(c)!.bid).toBe(false)
    }
  })

  it('has no PO code — posted out is a roster date, not a code', () => {
    expect(codeOf('PO')).toBeUndefined()
  })

  it('is case-insensitive and tolerant of stray whitespace', () => {
    expect(codeOf(' ll ')).toBe(CODES.LL)
  })

  it('returns undefined for an unknown code rather than throwing', () => {
    expect(codeOf('NOPE')).toBeUndefined()
    expect(codeOf('')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/codes.test.ts`
Expected: FAIL — cannot resolve `./codes`.

- [ ] **Step 3: Write the implementation**

`src/engine/codes.ts`:

```ts
// The day-code catalogue. Every code carries four facts so that availability,
// balances and bidding all read from one place rather than each re-deciding
// what a piece of text in a cell means.
//
// The spreadsheet this replaces had no such table: its availability counts
// tested for an EMPTY cell, so `AM` removed a whole person and so did SC duty,
// which is someone at work. `removes` and `duty` exist to end both of those.

export type CounterName = 'annual' | 'oil' | 'ccl' | 'pcl' | 'pl' | 'el' | 'fcl'

export interface DayCode {
  code: string
  label: string
  /** How much of the day the person is unavailable for. */
  removes: 0 | 0.5 | 1
  /** Which counter this draws down, and by how much. */
  spends: { counter: CounterName; amount: number } | null
  /** OIL credited by working this day. */
  earnsOil: 0 | 0.5 | 1
  /** Whether a person bids for this. Medical, courses and duty are not bid. */
  bid: boolean
  /** At work, but off the flying programme — excluded from flying counts. */
  duty: boolean
}

const def = (
  code: string,
  label: string,
  removes: 0 | 0.5 | 1,
  spends: { counter: CounterName; amount: number } | null,
  opts: { earnsOil?: 0 | 0.5 | 1; bid?: boolean; duty?: boolean } = {},
): DayCode => ({
  code,
  label,
  removes,
  spends,
  earnsOil: opts.earnsOil ?? 0,
  bid: opts.bid ?? true,
  duty: opts.duty ?? false,
})

export const CODES: Record<string, DayCode> = {
  LL: def('LL', 'local leave', 1, { counter: 'annual', amount: 1 }),
  AM: def('AM', 'half day leave (morning)', 0.5, { counter: 'annual', amount: 0.5 }),
  PM: def('PM', 'half day leave (afternoon)', 0.5, { counter: 'annual', amount: 0.5 }),
  OL: def('OL', 'overseas leave', 1, { counter: 'annual', amount: 1 }),
  OIL: def('OIL', 'full OIL', 1, { counter: 'oil', amount: 1 }),
  HO: def('HO', 'half OIL', 0.5, { counter: 'oil', amount: 0.5 }),
  CCL: def('CCL', 'child care leave', 1, { counter: 'ccl', amount: 1 }),
  PCL: def('PCL', 'parentcare leave', 1, { counter: 'pcl', amount: 1 }),
  PL: def('PL', 'paternity leave', 1, { counter: 'pl', amount: 1 }),
  EL: def('EL', 'embarkation leave', 1, { counter: 'el', amount: 1 }),
  FCL: def('FCL', 'FCL', 1, { counter: 'fcl', amount: 1 }),
  M: def('M', 'medical (HL/ATT C)', 1, null, { bid: false }),
  HL: def('HL', 'hospitalisation leave', 1, null, { bid: false }),
  CSE: def('CSE', 'course', 1, null, { bid: false }),
  OD: def('OD', 'overseas duty', 1, null, { bid: false }),
  FS: def('FS', 'full day SC duty', 0, null, { earnsOil: 1, bid: false, duty: true }),
  HS: def('HS', 'half day SC duty', 0, null, { earnsOil: 0.5, bid: false, duty: true }),
}

export function codeOf(code: string | undefined | null): DayCode | undefined {
  if (!code) return undefined
  return CODES[code.trim().toUpperCase()]
}

export function isDuty(code: string | undefined | null): boolean {
  return codeOf(code)?.duty ?? false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/codes.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/codes.ts src/engine/codes.test.ts
git commit -m "feat(engine): day-code catalogue with fractional removal"
```

---

### Task 3: The roster

**Files:**
- Create: `src/engine/people.ts`
- Test: `src/engine/people.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Seat`, `Band`, `Category`, `CATEGORIES`, `Person`, `categoryOf(person)`, `inSquadron(person, date)`

The four manning categories are derived from seat and band, never stored. That is what makes the RAPTOR merge cheap — RAPTOR already holds seat and the CAT ladder, so its roster drops in and the categories keep computing themselves.

Posted-out is a roster date range, not a per-day code. In the reference spreadsheet `PO` was the most common code in the file at 269 hand-typed cells; here the person simply stops being in the squadron.

- [ ] **Step 1: Write the failing test**

`src/engine/people.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { categoryOf, inSquadron, type Person } from './people'

const person = (over: Partial<Person> = {}): Person => ({
  id: 'p1',
  callsign: 'RAMP',
  seat: 'pilot',
  band: 'ops',
  sxo: false,
  from: null,
  to: null,
  ...over,
})

describe('categoryOf', () => {
  it('derives all four categories from seat and band', () => {
    expect(categoryOf(person({ seat: 'pilot', band: 'instructor' }))).toBe('IP')
    expect(categoryOf(person({ seat: 'pilot', band: 'ops' }))).toBe('OPSP')
    expect(categoryOf(person({ seat: 'wso', band: 'instructor' }))).toBe('IWSO')
    expect(categoryOf(person({ seat: 'wso', band: 'ops' }))).toBe('OPSW')
  })

  it('does not let the SXO flag change the category', () => {
    expect(categoryOf(person({ seat: 'wso', band: 'ops', sxo: true }))).toBe('OPSW')
  })
})

describe('inSquadron', () => {
  it('counts someone with no dates on any day', () => {
    expect(inSquadron(person(), '2026-01-01')).toBe(true)
  })

  it('stops counting a posted-out member from the day after their last day', () => {
    const p = person({ to: '2026-01-12' })
    expect(inSquadron(p, '2026-01-12')).toBe(true)
    expect(inSquadron(p, '2026-01-13')).toBe(false)
  })

  it('does not count an arrival before their first day', () => {
    const p = person({ from: '2026-02-01' })
    expect(inSquadron(p, '2026-01-31')).toBe(false)
    expect(inSquadron(p, '2026-02-01')).toBe(true)
  })

  it('handles someone who both arrives and leaves inside the period', () => {
    const p = person({ from: '2026-01-10', to: '2026-01-20' })
    expect(inSquadron(p, '2026-01-09')).toBe(false)
    expect(inSquadron(p, '2026-01-15')).toBe(true)
    expect(inSquadron(p, '2026-01-21')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/people.test.ts`
Expected: FAIL — cannot resolve `./people`.

- [ ] **Step 3: Write the implementation**

`src/engine/people.ts`:

```ts
// The roster. Categories are DERIVED from seat and band rather than stored,
// which is what lets RAPTOR's own roster replace this one without a migration:
// it already holds seat, the CAT ladder and an `sxo` qualification flag.

export type Seat = 'pilot' | 'wso'
/** `ops` is CAT D up to CAT A; `instructor` is the instructor grades above it. */
export type Band = 'instructor' | 'ops'
export type Category = 'IP' | 'OPSP' | 'IWSO' | 'OPSW'

export const CATEGORIES: Category[] = ['IP', 'OPSP', 'IWSO', 'OPSW']

export interface Person {
  id: string
  callsign: string
  seat: Seat
  band: Band
  /** Counted as an SXO on top of their normal category, never instead of it. */
  sxo: boolean
  /** First day in the squadron, inclusive. `null` means always. */
  from: string | null
  /** Last day in the squadron, inclusive — the posting-out date. `null` means still here. */
  to: string | null
}

export function categoryOf(p: Person): Category {
  if (p.seat === 'pilot') return p.band === 'instructor' ? 'IP' : 'OPSP'
  return p.band === 'instructor' ? 'IWSO' : 'OPSW'
}

// Plain string comparison is correct for `yyyy-mm-dd`: the format sorts
// lexicographically in date order, so no parsing (and no timezone) is involved.
export function inSquadron(p: Person, date: string): boolean {
  if (p.from && date < p.from) return false
  if (p.to && date > p.to) return false
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/people.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/people.ts src/engine/people.test.ts
git commit -m "feat(engine): roster with derived categories and posting dates"
```

---

### Task 4: The period and its days

**Files:**
- Create: `src/engine/period.ts`
- Test: `src/engine/period.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Stage`, `DayInfo`, `Period`, `buildDays(start, end)`, `isWeekend(date)`, `addDays(date, n)`

- [ ] **Step 1: Write the failing test**

`src/engine/period.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDays, buildDays, isWeekend } from './period'

describe('isWeekend', () => {
  it('recognises Saturday and Sunday', () => {
    expect(isWeekend('2026-01-03')).toBe(true)
    expect(isWeekend('2026-01-04')).toBe(true)
  })

  it('does not call a weekday a weekend', () => {
    expect(isWeekend('2026-01-02')).toBe(false)
    expect(isWeekend('2026-01-05')).toBe(false)
  })

  // The guard the rest of this file cannot provide. Under Pacific/Midway
  // (UTC-11, set in vite.config.ts) 2026-01-03 is a Saturday in UTC and a
  // Friday locally, so this assertion is impossible to pass with `getDay()`
  // in place of `getUTCDay()`. Prove it by making that swap and watching this
  // go red before trusting it.
  it('uses the UTC weekday, not the local one', () => {
    expect(isWeekend('2026-01-03')).toBe(true)
    expect(new Date(Date.UTC(2026, 0, 3)).getDay()).not.toBe(6)
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('buildDays', () => {
  it('builds every day of the range inclusive', () => {
    const days = buildDays('2026-01-01', '2026-01-05')
    expect(days).toHaveLength(5)
    expect(days[0].date).toBe('2026-01-01')
    expect(days[4].date).toBe('2026-01-05')
  })

  it('builds a full quarter', () => {
    expect(buildDays('2026-01-01', '2026-03-31')).toHaveLength(90)
  })

  it('starts every day unblocked, not a public holiday, with two empty event lines', () => {
    const [d] = buildDays('2026-01-01', '2026-01-01')
    expect(d.blocked).toBe(false)
    expect(d.blockedReason).toBe('')
    expect(d.ph).toBe(false)
    expect(d.events).toEqual(['', ''])
  })

  it('returns nothing when the end precedes the start', () => {
    expect(buildDays('2026-01-05', '2026-01-01')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/period.test.ts`
Expected: FAIL — cannot resolve `./period`.

- [ ] **Step 3: Write the implementation**

`src/engine/period.ts`:

```ts
// A leave war period and the days inside it.
//
// Dates are `yyyy-mm-dd` strings throughout, never Date objects. Every parse
// goes through Date.UTC and every read uses a getUTC* accessor: local-time
// accessors shift the day for anyone east or west of UTC, which would silently
// move a weekend and therefore silently move an OIL credit.

export type Stage = 'draft' | 'open' | 'closed' | 'published'

export interface DayInfo {
  date: string
  /** Two free-text event lines, matching the two EVENT rows of the sheet. */
  events: [string, string]
  /** Leave is discouraged. Bids are still accepted — warn, never block. */
  blocked: boolean
  blockedReason: string
  /** A public holiday earns OIL for duty exactly as a weekend does. */
  ph: boolean
}

export interface Period {
  id: string
  name: string
  start: string
  end: string
  stage: Stage
  days: DayInfo[]
}

function toUTC(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

const DAY_MS = 86_400_000

export function addDays(date: string, n: number): string {
  return fromUTC(toUTC(date) + n * DAY_MS)
}

export function isWeekend(date: string): boolean {
  const day = new Date(toUTC(date)).getUTCDay()
  return day === 0 || day === 6
}

export function buildDays(start: string, end: string): DayInfo[] {
  const days: DayInfo[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({ date: d, events: ['', ''], blocked: false, blockedReason: '', ph: false })
  }
  return days
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/period.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/period.ts src/engine/period.test.ts
git commit -m "feat(engine): period days, UTC-safe date arithmetic"
```

---

### Task 5: The requirement model

**Files:**
- Create: `src/engine/requirements.ts`
- Test: `src/engine/requirements.test.ts`

**Interfaces:**
- Consumes: `Category` from `./people`
- Produces: `Threshold`, `RuleTarget`, `ManningRule`, `Requirement`, `Requirements`, `requirementFor(reqs, date)`

Set once for the whole period as a default, overridden only on days that differ — most of a quarter is identical and nobody should type the same numbers ninety times.

- [ ] **Step 1: Write the failing test**

`src/engine/requirements.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { requirementFor, type Requirement, type Requirements } from './requirements'

const base: Requirement = {
  sets: { amber: 5, red: 4.5 },
  rules: [
    { id: 'ip', label: 'IP', target: { kind: 'category', categories: ['IP'] }, threshold: { amber: 3, red: 2 } },
    { id: 'instr', label: 'IP + IWSO', target: { kind: 'category', categories: ['IP', 'IWSO'] }, threshold: { amber: 5, red: 4 } },
    { id: 'sxo', label: 'SXO', target: { kind: 'sxo' }, threshold: { amber: 1, red: 1 } },
  ],
}

const reqs: Requirements = { default: base, overrides: {} }

describe('requirementFor', () => {
  it('returns the period default for an ordinary day', () => {
    expect(requirementFor(reqs, '2026-01-07')).toBe(base)
  })

  it('returns the override for a day that has one', () => {
    const heavy: Requirement = { sets: { amber: 7, red: 6 }, rules: [] }
    const withOverride: Requirements = { default: base, overrides: { '2026-01-20': heavy } }
    expect(requirementFor(withOverride, '2026-01-20')).toBe(heavy)
    expect(requirementFor(withOverride, '2026-01-21')).toBe(base)
  })

  it('lets a day require no manning at all', () => {
    const none: Requirement = { sets: null, rules: [] }
    const withOverride: Requirements = { default: base, overrides: { '2026-01-25': none } }
    expect(requirementFor(withOverride, '2026-01-25').sets).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/requirements.test.ts`
Expected: FAIL — cannot resolve `./requirements`.

- [ ] **Step 3: Write the implementation**

`src/engine/requirements.ts`:

```ts
// What the scheduler says each day needs.
//
// Two kinds of rule are live at once: a SET requirement (a set is a pilot plus
// a WSO, counted fractionally, which is why "4.5 sets" is expressible at all)
// and CATEGORY minimums, including combinations like IP + IWSO and named roles
// like SXO. A day takes the worst result of every rule that applies to it.

import type { Category } from './people'

export interface Threshold {
  /** Below this, give the scheduler a heads-up. */
  amber: number
  /** Below this, the day is under-manned. */
  red: number
}

export type RuleTarget =
  /** Sum the availability of everyone in any of these categories. */
  | { kind: 'category'; categories: Category[] }
  /** Sum the availability of everyone carrying the SXO flag. */
  | { kind: 'sxo' }

export interface ManningRule {
  id: string
  label: string
  target: RuleTarget
  threshold: Threshold
}

export interface Requirement {
  /** In sets, where one set is a pilot plus a WSO. `null` means no set rule. */
  sets: Threshold | null
  rules: ManningRule[]
}

export interface Requirements {
  default: Requirement
  /** Keyed by `yyyy-mm-dd`. Only days that differ from the default appear. */
  overrides: Record<string, Requirement>
}

export function requirementFor(reqs: Requirements, date: string): Requirement {
  return reqs.overrides[date] ?? reqs.default
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/requirements.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/requirements.ts src/engine/requirements.test.ts
git commit -m "feat(engine): requirement model with period default and day overrides"
```

---

### Task 6: Availability and the counts

**Files:**
- Create: `src/engine/availability.ts`
- Test: `src/engine/availability.test.ts`

**Interfaces:**
- Consumes: `codeOf` from `./codes`; `Person`, `Category`, `categoryOf`, `inSquadron` from `./people`
- Produces: `Grid`, `DayCounts`, `availabilityOf(person, date, code)`, `countsFor(people, grid, date)`

This is where the spreadsheet's two counting bugs are fixed: a half-day removes 0.5 rather than a whole person, and someone on SC duty is reported separately rather than being lumped in with people on leave.

- [ ] **Step 1: Write the failing test**

`src/engine/availability.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { availabilityOf, countsFor, type Grid } from './availability'
import type { Person } from './people'

const p = (id: string, seat: 'pilot' | 'wso', band: 'instructor' | 'ops', over: Partial<Person> = {}): Person => ({
  id, callsign: id.toUpperCase(), seat, band, sxo: false, from: null, to: null, ...over,
})

describe('availabilityOf', () => {
  const someone = p('a', 'pilot', 'ops')

  it('counts a free person as a whole person', () => {
    expect(availabilityOf(someone, '2026-01-05', undefined)).toBe(1)
  })

  it('counts a half day as half a person, which the spreadsheet could not', () => {
    expect(availabilityOf(someone, '2026-01-05', 'AM')).toBe(0.5)
    expect(availabilityOf(someone, '2026-01-05', 'HO')).toBe(0.5)
  })

  it('counts a full day of leave as nobody', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL')).toBe(0)
    expect(availabilityOf(someone, '2026-01-05', 'OD')).toBe(0)
  })

  it('does not count someone on SC duty toward flying, though they are at work', () => {
    expect(availabilityOf(someone, '2026-01-05', 'FS')).toBe(0)
    expect(availabilityOf(someone, '2026-01-05', 'HS')).toBe(0)
  })

  it('does not count someone who has been posted out', () => {
    const gone = p('b', 'pilot', 'ops', { to: '2026-01-12' })
    expect(availabilityOf(gone, '2026-01-12', undefined)).toBe(1)
    expect(availabilityOf(gone, '2026-01-13', undefined)).toBe(0)
  })

  it('treats an unknown code as no effect rather than removing the person', () => {
    expect(availabilityOf(someone, '2026-01-05', 'ZZZ')).toBe(1)
  })
})

describe('countsFor', () => {
  const people: Person[] = [
    p('ip1', 'pilot', 'instructor'),
    p('ip2', 'pilot', 'instructor'),
    p('op1', 'pilot', 'ops'),
    p('iw1', 'wso', 'instructor'),
    p('ow1', 'wso', 'ops'),
    p('ow2', 'wso', 'ops', { sxo: true }),
  ]

  it('counts each category', () => {
    const c = countsFor(people, {}, '2026-01-05')
    expect(c.byCategory).toEqual({ IP: 2, OPSP: 1, IWSO: 1, OPSW: 2 })
  })

  it('counts SXO separately without removing them from their own category', () => {
    const c = countsFor(people, {}, '2026-01-05')
    expect(c.sxo).toBe(1)
    expect(c.byCategory.OPSW).toBe(2)
  })

  it('makes a set the lesser of available pilots and available WSOs', () => {
    // 3 pilots, 3 WSOs -> 3 sets
    expect(countsFor(people, {}, '2026-01-05').sets).toBe(3)
  })

  it('produces a fractional set count from a half day', () => {
    const grid: Grid = { ow1: { '2026-01-05': 'AM' } }
    // pilots 3, wsos 2.5 -> 2.5 sets
    expect(countsFor(people, grid, '2026-01-05').sets).toBe(2.5)
  })

  it('reports people on SC duty separately from people on leave', () => {
    const grid: Grid = { ip1: { '2026-01-05': 'FS' }, op1: { '2026-01-05': 'LL' } }
    const c = countsFor(people, grid, '2026-01-05')
    expect(c.duty).toBe(1)
    expect(c.byCategory.IP).toBe(1)
    expect(c.byCategory.OPSP).toBe(0)
  })

  it('drops a posted-out member from every count', () => {
    const gone = [...people, p('old', 'pilot', 'instructor', { to: '2026-01-01' })]
    expect(countsFor(gone, {}, '2026-01-05').byCategory.IP).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/availability.test.ts`
Expected: FAIL — cannot resolve `./availability`.

- [ ] **Step 3: Write the implementation**

`src/engine/availability.ts`:

```ts
// How much of each person each day actually has, and the totals a day is
// judged on.
//
// The sheet this replaces counted EMPTY cells, so `AM` cost a whole person and
// SC duty — someone at work — was indistinguishable from someone on leave.
// Both are fixed here: availability is fractional, and duty is reported on its
// own line rather than hidden inside the shortfall.

import { codeOf } from './codes'
import { categoryOf, inSquadron, type Category, type Person } from './people'

/** `personId -> date -> code`. Sparse: most cells are empty. */
export type Grid = Record<string, Record<string, string>>

export interface DayCounts {
  byCategory: Record<Category, number>
  /** Availability of everyone carrying the SXO flag, counted on top of their category. */
  sxo: number
  /** The lesser of available pilots and available WSOs. */
  sets: number
  /** Head count on SC duty — at work, off the flying programme. */
  duty: number
}

export function availabilityOf(p: Person, date: string, code: string | undefined): number {
  if (!inSquadron(p, date)) return 0
  const c = codeOf(code)
  // An unknown code must not remove anyone. A typo should look wrong on screen,
  // not quietly delete a person from the manning picture.
  if (!c) return 1
  if (c.duty) return 0
  return 1 - c.removes
}

export function countsFor(people: Person[], grid: Grid, date: string): DayCounts {
  const byCategory = { IP: 0, OPSP: 0, IWSO: 0, OPSW: 0 } as Record<Category, number>
  let sxo = 0
  let duty = 0
  let pilots = 0
  let wsos = 0

  for (const p of people) {
    const code = grid[p.id]?.[date]
    if (inSquadron(p, date) && codeOf(code)?.duty) duty += 1

    const have = availabilityOf(p, date, code)
    if (have === 0) continue

    byCategory[categoryOf(p)] += have
    if (p.sxo) sxo += have
    if (p.seat === 'pilot') pilots += have
    else wsos += have
  }

  // A set is a crewed jet: one pilot and one WSO. Whichever seat runs out
  // first caps the number of sets, so the count is the lesser of the two.
  return { byCategory, sxo, sets: Math.min(pilots, wsos), duty }
}
```

Do **not** re-export `CATEGORIES` from here. `src/engine/index.ts` does
`export *` from both this module and `./people`; a name exported by two of
them becomes ambiguous and stops being exported from the barrel at all.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/availability.test.ts`
Expected: PASS, 16 tests.

Three of those go beyond the cases listed above, and they are the ones that
matter most, because the listed set does not actually pin the logic:

- A `sets` case where **pilots** are the constraining seat. Every case above
  leaves WSOs equal-or-lesser, so a regression to `sets: wsos` — dropping
  pilots from the calculation entirely — passes all of them.
- A **posted-out person carrying `FS` on a date after their `to`**, asserting
  they stay out of the `duty` tally. Nothing above exercises that guard.
- `HS` reaching the `duty` tally through `countsFor`, and `PM` exercised at
  all.

Prove the first two by making the exact break each one guards and watching it
go red before trusting it.

- [ ] **Step 5: Commit**

```bash
git add src/engine/availability.ts src/engine/availability.test.ts
git commit -m "feat(engine): fractional availability and per-day counts"
```

---

### Task 7: Evaluating a day against its rules

**Files:**
- Create: `src/engine/evaluate.ts`
- Test: `src/engine/evaluate.test.ts`

**Interfaces:**
- Consumes: `Grid`, `DayCounts`, `countsFor` from `./availability`; `Person` from `./people`; `Requirements`, `Requirement`, `ManningRule`, `requirementFor` from `./requirements`
- Produces: `Verdict`, `RuleResult`, `DayVerdict`, `evaluateDay(people, grid, reqs, date)`, `evaluatePeriod(people, grid, reqs, dates)`, `worst(a, b)`

- [ ] **Step 1: Write the failing test**

`src/engine/evaluate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Grid } from './availability'
import { evaluateDay, evaluatePeriod, worst } from './evaluate'
import type { Person } from './people'
import type { Requirements } from './requirements'

const p = (id: string, seat: 'pilot' | 'wso', band: 'instructor' | 'ops', over: Partial<Person> = {}): Person => ({
  id, callsign: id.toUpperCase(), seat, band, sxo: false, from: null, to: null, ...over,
})

const people: Person[] = [
  p('ip1', 'pilot', 'instructor'),
  p('ip2', 'pilot', 'instructor'),
  p('op1', 'pilot', 'ops'),
  p('iw1', 'wso', 'instructor'),
  p('ow1', 'wso', 'ops'),
  p('ow2', 'wso', 'ops', { sxo: true }),
]

const reqs: Requirements = {
  default: {
    sets: { amber: 3, red: 2 },
    rules: [
      { id: 'ip', label: 'IP', target: { kind: 'category', categories: ['IP'] }, threshold: { amber: 2, red: 1 } },
      { id: 'sxo', label: 'SXO', target: { kind: 'sxo' }, threshold: { amber: 1, red: 1 } },
    ],
  },
  overrides: {},
}

const D = '2026-01-05'

describe('worst', () => {
  it('ranks red above amber above ok', () => {
    expect(worst('ok', 'amber')).toBe('amber')
    expect(worst('amber', 'red')).toBe('red')
    expect(worst('red', 'ok')).toBe('red')
    expect(worst('ok', 'ok')).toBe('ok')
  })
})

describe('evaluateDay', () => {
  it('is ok when every rule is met', () => {
    expect(evaluateDay(people, {}, reqs, D).verdict).toBe('ok')
  })

  it('goes amber when a count falls below the amber figure but not the red', () => {
    // one IP away -> IP = 1, amber 2, red 1 -> below amber, not below red
    const grid: Grid = { ip1: { [D]: 'LL' } }
    const day = evaluateDay(people, grid, reqs, D)
    expect(day.results.find(r => r.ruleId === 'ip')!.verdict).toBe('amber')
    expect(day.verdict).toBe('amber')
  })

  it('goes red when a count falls below the red figure', () => {
    const grid: Grid = { ip1: { [D]: 'LL' }, ip2: { [D]: 'LL' } }
    const day = evaluateDay(people, grid, reqs, D)
    expect(day.results.find(r => r.ruleId === 'ip')!.verdict).toBe('red')
    expect(day.verdict).toBe('red')
  })

  it('takes the worst result across all rules — one broken rule is enough', () => {
    const grid: Grid = { ow2: { [D]: 'LL' } } // SXO gone: sxo rule red, others fine
    expect(evaluateDay(people, grid, reqs, D).verdict).toBe('red')
  })

  it('treats exactly the red figure as met, not as a breach', () => {
    const grid: Grid = { ip1: { [D]: 'LL' } } // IP = 1, red = 1
    expect(evaluateDay(people, grid, reqs, D).results.find(r => r.ruleId === 'ip')!.verdict).toBe('amber')
  })

  it('judges the set rule fractionally', () => {
    const grid: Grid = { ow1: { [D]: 'AM' }, ow2: { [D]: 'LL' } } // wsos = 1.5 -> sets 1.5
    const sets = evaluateDay(people, grid, reqs, D).results.find(r => r.ruleId === 'sets')!
    expect(sets.have).toBe(1.5)
    expect(sets.verdict).toBe('red')
  })

  it('reports a rule with no set requirement without inventing one', () => {
    const noSets: Requirements = { default: { sets: null, rules: [] }, overrides: {} }
    const day = evaluateDay(people, {}, noSets, D)
    expect(day.results).toEqual([])
    expect(day.verdict).toBe('ok')
  })

  it('uses a day override in place of the default', () => {
    const strict: Requirements = {
      default: reqs.default,
      overrides: { [D]: { sets: { amber: 99, red: 98 }, rules: [] } },
    }
    expect(evaluateDay(people, {}, strict, D).verdict).toBe('red')
  })

  it('carries the counts so the interface need not recompute them', () => {
    expect(evaluateDay(people, {}, reqs, D).counts.byCategory.IP).toBe(2)
  })
})

describe('evaluatePeriod', () => {
  it('returns a verdict per date, keyed by date', () => {
    const out = evaluatePeriod(people, {}, reqs, ['2026-01-05', '2026-01-06'])
    expect(Object.keys(out)).toEqual(['2026-01-05', '2026-01-06'])
    expect(out['2026-01-06'].verdict).toBe('ok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/evaluate.test.ts`
Expected: FAIL — cannot resolve `./evaluate`.

- [ ] **Step 3: Write the implementation**

`src/engine/evaluate.ts`:

```ts
// Judging a day against its rules.
//
// A day takes the WORST result of every rule applying to it: one broken rule
// is enough to make it red. Meeting a threshold exactly is met, not breached —
// "IP >= 2" with two IPs available is fine.

import { countsFor, type DayCounts, type Grid } from './availability'
import type { Person } from './people'
import { requirementFor, type ManningRule, type Requirements } from './requirements'

export type Verdict = 'ok' | 'amber' | 'red'

export interface RuleResult {
  ruleId: string
  label: string
  have: number
  amber: number
  red: number
  verdict: Verdict
}

export interface DayVerdict {
  date: string
  verdict: Verdict
  results: RuleResult[]
  counts: DayCounts
}

const RANK: Record<Verdict, number> = { ok: 0, amber: 1, red: 2 }

export function worst(a: Verdict, b: Verdict): Verdict {
  return RANK[a] >= RANK[b] ? a : b
}

function judge(have: number, amber: number, red: number): Verdict {
  if (have < red) return 'red'
  if (have < amber) return 'amber'
  return 'ok'
}

function haveFor(rule: ManningRule, counts: DayCounts): number {
  if (rule.target.kind === 'sxo') return counts.sxo
  return rule.target.categories.reduce((sum, c) => sum + counts.byCategory[c], 0)
}

export function evaluateDay(
  people: Person[],
  grid: Grid,
  reqs: Requirements,
  date: string,
): DayVerdict {
  const counts = countsFor(people, grid, date)
  const req = requirementFor(reqs, date)
  const results: RuleResult[] = []

  if (req.sets) {
    results.push({
      ruleId: 'sets',
      label: 'Crew sets',
      have: counts.sets,
      amber: req.sets.amber,
      red: req.sets.red,
      verdict: judge(counts.sets, req.sets.amber, req.sets.red),
    })
  }

  for (const rule of req.rules) {
    const have = haveFor(rule, counts)
    results.push({
      ruleId: rule.id,
      label: rule.label,
      have,
      amber: rule.threshold.amber,
      red: rule.threshold.red,
      verdict: judge(have, rule.threshold.amber, rule.threshold.red),
    })
  }

  const verdict = results.reduce<Verdict>((acc, r) => worst(acc, r.verdict), 'ok')
  return { date, verdict, results, counts }
}

export function evaluatePeriod(
  people: Person[],
  grid: Grid,
  reqs: Requirements,
  dates: string[],
): Record<string, DayVerdict> {
  const out: Record<string, DayVerdict> = {}
  for (const date of dates) out[date] = evaluateDay(people, grid, reqs, date)
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/evaluate.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/evaluate.ts src/engine/evaluate.test.ts
git commit -m "feat(engine): day verdicts from counts against requirements"
```

---

### Task 8: Seed data and the engine barrel

**Files:**
- Create: `src/engine/seed.ts`, `src/engine/index.ts`
- Test: `src/engine/seed.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces: `seedPeople()`, `seedPeriod()`, `seedRequirements()`, `seedGrid()`; and the barrel re-exporting every engine module

Callsigns are taken from the reference workbook so the matrix looks like the real thing on first run. The quarter matches its first sheet: 1 Jan – 31 Mar 2026.

- [ ] **Step 1: Write the failing test**

`src/engine/seed.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { evaluateDay } from './evaluate'
import { seedGrid, seedPeople, seedPeriod, seedRequirements } from './seed'

describe('seed', () => {
  it('has a roster with all four categories represented', () => {
    const people = seedPeople()
    expect(people.length).toBeGreaterThanOrEqual(12)
    const seats = new Set(people.map(p => `${p.seat}-${p.band}`))
    expect(seats).toEqual(new Set(['pilot-instructor', 'pilot-ops', 'wso-instructor', 'wso-ops']))
  })

  it('has exactly one SXO', () => {
    expect(seedPeople().filter(p => p.sxo)).toHaveLength(1)
  })

  it('has someone posted out mid-quarter so the roster dates are exercised', () => {
    expect(seedPeople().some(p => p.to !== null)).toBe(true)
  })

  it('covers the first quarter of 2026', () => {
    const period = seedPeriod()
    expect(period.start).toBe('2026-01-01')
    expect(period.end).toBe('2026-03-31')
    expect(period.days).toHaveLength(90)
  })

  it('marks New Year as a public holiday and blocks at least one day', () => {
    const period = seedPeriod()
    expect(period.days[0].ph).toBe(true)
    expect(period.days.some(d => d.blocked)).toBe(true)
  })

  it('evaluates every seeded day without throwing', () => {
    const people = seedPeople()
    const grid = seedGrid()
    const reqs = seedRequirements()
    for (const day of seedPeriod().days) {
      expect(['ok', 'amber', 'red']).toContain(evaluateDay(people, grid, reqs, day.date).verdict)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/seed.test.ts`
Expected: FAIL — cannot resolve `./seed`.

- [ ] **Step 3: Write the implementation**

`src/engine/seed.ts`:

```ts
// Demo data, shaped like the squadron's own quarterly sheet so the matrix
// looks like the real thing on first run. Callsigns are the reference
// workbook's. Replaced by real data once a backend exists.

import { buildDays, type Period } from './period'
import type { Person } from './people'
import type { Grid } from './availability'
import type { Requirements } from './requirements'

type Row = [string, Person['seat'], Person['band'], boolean, string | null]

// callsign, seat, band, sxo, posted-out date
const ROWS: Row[] = [
  ['RAMP', 'pilot', 'ops', true, null],
  ['TATA', 'pilot', 'instructor', false, null],
  ['SPLICE', 'wso', 'instructor', false, null],
  ['JAGUAR', 'pilot', 'ops', false, null],
  ['SWITCHER', 'pilot', 'ops', false, '2026-01-12'],
  ['ASICS', 'pilot', 'ops', false, null],
  ['PIPPER', 'wso', 'ops', false, null],
  ['DUSK', 'wso', 'ops', false, null],
  ['MILES', 'pilot', 'instructor', false, null],
  ['ROULETTE', 'wso', 'instructor', false, null],
  ['CROSS', 'wso', 'ops', false, null],
  ['DECAL', 'pilot', 'ops', false, null],
  ['SKIN', 'wso', 'ops', false, null],
  ['SLAMMED', 'pilot', 'ops', false, null],
  ['CAGE', 'wso', 'ops', false, null],
  ['RESET', 'pilot', 'instructor', false, null],
]

export function seedPeople(): Person[] {
  return ROWS.map(([callsign, seat, band, sxo, to]) => ({
    id: callsign.toLowerCase(),
    callsign,
    seat,
    band,
    sxo,
    from: null,
    to,
  }))
}

export function seedPeriod(): Period {
  const days = buildDays('2026-01-01', '2026-03-31')
  for (const d of days) {
    if (d.date === '2026-01-01') {
      d.ph = true
      d.events[0] = 'PH'
    }
    if (d.date === '2026-02-17' || d.date === '2026-02-18') {
      d.ph = true
      d.events[0] = 'PH'
    }
    // A week of heavy tasking where leave is discouraged but still biddable.
    if (d.date >= '2026-03-09' && d.date <= '2026-03-13') {
      d.blocked = true
      d.blockedReason = 'Exercise week'
    }
  }
  return { id: 'q1-2026', name: 'JAN - MAR 26', start: '2026-01-01', end: '2026-03-31', stage: 'open', days }
}

export function seedRequirements(): Requirements {
  return {
    default: {
      sets: { amber: 5, red: 4.5 },
      rules: [
        { id: 'ip', label: 'IP', target: { kind: 'category', categories: ['IP'] }, threshold: { amber: 3, red: 2 } },
        { id: 'iwso', label: 'IWSO', target: { kind: 'category', categories: ['IWSO'] }, threshold: { amber: 3, red: 2 } },
        { id: 'instr', label: 'IP + IWSO', target: { kind: 'category', categories: ['IP', 'IWSO'] }, threshold: { amber: 5, red: 4 } },
        { id: 'opsp', label: 'OPSP', target: { kind: 'category', categories: ['OPSP'] }, threshold: { amber: 4, red: 3 } },
        { id: 'opsw', label: 'OPSW', target: { kind: 'category', categories: ['OPSW'] }, threshold: { amber: 4, red: 3 } },
        { id: 'sxo', label: 'SXO', target: { kind: 'sxo' }, threshold: { amber: 1, red: 1 } },
      ],
    },
    overrides: {},
  }
}

export function seedGrid(): Grid {
  return {
    ramp: { '2026-01-01': 'OL', '2026-01-03': 'FS', '2026-02-10': 'HO' },
    tata: { '2026-01-01': 'FS', '2026-01-04': 'FS', '2026-01-09': 'OIL' },
    splice: { '2026-01-05': 'M', '2026-01-06': 'M', '2026-01-08': 'LL' },
    jaguar: { '2026-01-16': 'OL', '2026-01-17': 'OL', '2026-01-19': 'OL' },
    asics: { '2026-01-08': 'LL', '2026-01-09': 'LL', '2026-01-23': 'AM' },
    pipper: { '2026-01-12': 'CSE', '2026-01-13': 'CSE' },
    miles: { '2026-02-02': 'LL', '2026-02-03': 'PM' },
    roulette: { '2026-01-15': 'CCL' },
    cross: { '2026-03-10': 'LL' },
    skin: { '2026-01-03': 'HS' },
  }
}
```

`src/engine/index.ts`:

```ts
// The barrel. UI and tests import from `../engine`, so a new engine module
// wants a line here.
export * from './availability'
export * from './codes'
export * from './evaluate'
export * from './people'
export * from './period'
export * from './requirements'
export * from './seed'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/seed.test.ts`
Expected: PASS, 8 tests.

Two of those go beyond the cases above and matter more than any of them,
because this is the one place a typo raises nothing at all: an unknown grid id
is simply never looked up, and an unknown code makes `codeOf` return
`undefined`, which `availabilityOf` deliberately treats as *fully available*.
So pin both — every id key in `seedGrid()` resolves to a person in
`seedPeople()`, and every code value resolves through `codeOf` — and make each
failure name the offending id or code, since a bare boolean tells whoever
breaks it nothing. Prove both by planting a bad id and a bad code and watching
them go red.

- [ ] **Step 5: Commit**

```bash
git add src/engine/seed.ts src/engine/index.ts src/engine/seed.test.ts
git commit -m "feat(engine): seed roster, quarter and requirements"
```

---

### Task 9: The store and the storage seam

**Files:**
- Create: `src/state/storage.ts`, `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Person`, `Period`, `Requirements`, `seedGrid`, `seedPeople`, `seedPeriod`, `seedRequirements` from `../engine`
- Produces: `StorageBackend`, `memoryBackend()`, `localBackend()`; `getState()`, `setCell(personId, date, code)`, `subscribe(fn)`, `getVersion()`, `initStore(backend?)`

Swapping the backend is `initStore(backend)`'s job — there is deliberately no
separate setter, because changing the backend without re-reading through it
would leave the store holding another backend's data.

Storage sits behind one seam so that moving to a shared server later is a single change rather than a rewrite of every write path. Every write goes through `setCell` — bypassing it is always a bug, because a write that skips it never notifies the interface and never persists.

- [ ] **Step 1: Write the failing test**

`src/state/store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getState, getVersion, initStore, setCell, subscribe } from './store'
import { memoryBackend } from './storage'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('store', () => {
  it('boots with the seeded roster and period', () => {
    expect(getState().people.length).toBeGreaterThan(0)
    expect(getState().period.days).toHaveLength(90)
  })

  it('writes a cell into the grid', () => {
    setCell('ramp', '2026-01-20', 'LL')
    expect(getState().grid.ramp['2026-01-20']).toBe('LL')
  })

  it('clears a cell when given an empty code', () => {
    setCell('ramp', '2026-01-20', 'LL')
    setCell('ramp', '2026-01-20', '')
    expect(getState().grid.ramp?.['2026-01-20']).toBeUndefined()
  })

  it('bumps the version on every write so subscribers re-read', () => {
    const before = getVersion()
    setCell('ramp', '2026-01-21', 'LL')
    expect(getVersion()).toBe(before + 1)
  })

  it('notifies subscribers', () => {
    const fn = vi.fn()
    subscribe(fn)
    setCell('ramp', '2026-01-22', 'LL')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('stops notifying after unsubscribe', () => {
    const fn = vi.fn()
    subscribe(fn)()
    setCell('ramp', '2026-01-23', 'LL')
    expect(fn).not.toHaveBeenCalled()
  })

  it('persists the grid through the backend and reloads it', () => {
    const backend = memoryBackend()
    initStore(backend)
    setCell('ramp', '2026-01-24', 'LL')
    initStore(backend)
    expect(getState().grid.ramp['2026-01-24']).toBe('LL')
  })

  it('falls back to the seed when the backend holds unreadable data', () => {
    const backend = memoryBackend()
    backend.write('grid', 'not json at all')
    initStore(backend)
    expect(getState().grid).toBeTypeOf('object')
    expect(getState().people.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — cannot resolve `./store`.

- [ ] **Step 3: Write the storage seam**

`src/state/storage.ts`:

```ts
// The one place storage is touched.
//
// A leave war is inherently shared, and browser storage is not — forty people
// bidding in forty browsers is not a leave war. The seam exists so that the
// shared backend arriving next replaces one module rather than every write
// path in the codebase.

export interface StorageBackend {
  read(key: string): string | null
  write(key: string, value: string): void
}

export function memoryBackend(): StorageBackend {
  const map = new Map<string, string>()
  return {
    read: key => map.get(key) ?? null,
    write: (key, value) => void map.set(key, value),
  }
}

export function localBackend(): StorageBackend {
  return {
    read: key => {
      try {
        return localStorage.getItem(`leavewar:${key}`)
      } catch {
        // Private browsing and disabled storage both throw. A leave war that
        // cannot persist is still worth reading, so degrade rather than die.
        return null
      }
    },
    write: (key, value) => {
      try {
        localStorage.setItem(`leavewar:${key}`, value)
      } catch {
        /* ignore — see read() */
      }
    },
  }
}
```

- [ ] **Step 4: Write the store**

`src/state/store.ts`:

```ts
// The store. `setCell` is the ONLY write path: it updates the grid, persists
// through the backend, bumps the version and notifies. A write that skips it
// is invisible to the interface and is never saved.

import {
  seedGrid,
  seedPeople,
  seedPeriod,
  seedRequirements,
  type Grid,
  type Period,
  type Person,
  type Requirements,
} from '../engine'
import { localBackend, memoryBackend, type StorageBackend } from './storage'

interface State {
  people: Person[]
  period: Period
  requirements: Requirements
  grid: Grid
}

let backend: StorageBackend = memoryBackend()
let state: State = blank()
let version = 0
const listeners = new Set<() => void>()

function blank(): State {
  return {
    people: seedPeople(),
    period: seedPeriod(),
    requirements: seedRequirements(),
    grid: seedGrid(),
  }
}

function loadGrid(): Grid {
  const raw = backend.read('grid')
  if (!raw) return seedGrid()
  try {
    const parsed = JSON.parse(raw)
    // Anything that is not a plain object is unusable; the seed is a better
    // answer than a crash on boot.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return seedGrid()
    return parsed as Grid
  } catch {
    return seedGrid()
  }
}

export function initStore(b?: StorageBackend): void {
  backend = b ?? localBackend()
  state = blank()
  state.grid = loadGrid()
  version = 0
  listeners.clear()
}

export function getState(): State {
  return state
}

export function getVersion(): number {
  return version
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

function notify(): void {
  version += 1
  for (const fn of listeners) fn()
}

export function setCell(personId: string, date: string, code: string): void {
  const row = { ...(state.grid[personId] ?? {}) }
  const clean = code.trim().toUpperCase()
  if (clean) row[date] = clean
  else delete row[date]

  state = { ...state, grid: { ...state.grid, [personId]: row } }
  backend.write('grid', JSON.stringify(state.grid))
  notify()
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS, 14 tests.

Six of those go beyond the cases above, and they cover the parts most likely
to rot unnoticed:

- **`localBackend()` on both paths** — a normal round-trip, and one where
  `localStorage` access throws (private browsing, storage disabled), asserting
  read returns null and write does not propagate. Restore the real storage in
  an `afterEach`, unconditionally: a spy left installed corrupts later tests.
- **Each degradation branch separately** — `'[]'`, `'null'` and a bare
  primitive like `'42'` each falling back to the seed. The invalid-JSON case
  exercises the `catch`; these exercise the shape guard, which is a different
  branch.
- **The `initStore` subscriber contract** — subscribe, re-init, write, assert
  the earlier subscriber is not called. The clearing is deliberate (a fresh
  boot is a clean slate) but it is a trap for anything that calls `initStore`
  after mount, so it is pinned as a contract rather than left implicit.

- [ ] **Step 6: Commit**

```bash
git add src/state/ && git commit -m "feat(state): store with a swappable storage seam"
```

---

### Task 10: The matrix

**Files:**
- Create: `src/ui/Matrix.tsx`, `src/ui/matrix.css`, `src/ui/useStore.ts`
- Modify: `src/main.tsx`
- Test: `src/ui/matrix.test.tsx`

**Interfaces:**
- Consumes: `getState`, `getVersion`, `subscribe`, `initStore` from `../state/store`; `evaluatePeriod`, `categoryOf` from `../engine`
- Produces: `<Matrix />`, `useVersion()`

People down, days across, one surface on every device. The callsign column is frozen and the date header sticky, because a matrix you have to pinch at is the complaint rather than the solution.

- [ ] **Step 1: Write the failing test**

`src/ui/matrix.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { initStore, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('Matrix', () => {
  it('renders a row for every person with their callsign and category', () => {
    render(<Matrix />)
    const row = screen.getByTestId('row-ramp')
    expect(within(row).getByText('RAMP')).toBeTruthy()
    expect(within(row).getByText('OPSP')).toBeTruthy()
  })

  it('renders a column for every day of the quarter', () => {
    render(<Matrix />)
    expect(screen.getAllByTestId(/^head-/)).toHaveLength(90)
  })

  it('shows a code in the cell it belongs to', () => {
    setCell('ramp', '2026-01-20', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('cell-ramp-2026-01-20').textContent).toBe('LL')
  })

  it('marks a blocked day on the date header', () => {
    render(<Matrix />)
    expect(screen.getByTestId('head-2026-03-10').className).toContain('blocked')
    expect(screen.getByTestId('head-2026-01-07').className).not.toContain('blocked')
  })

  it('marks SC duty cells as duty so they read as earning OIL', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-tata-2026-01-01').className).toContain('duty')
  })

  it('greys the cells of a posted-out member from the day after they leave', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-switcher-2026-01-12').className).not.toContain('gone')
    expect(screen.getByTestId('cell-switcher-2026-01-13').className).toContain('gone')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/matrix.test.tsx`
Expected: FAIL — cannot resolve `./Matrix`.

- [ ] **Step 3: Write the store hook**

`src/ui/useStore.ts`:

```ts
import { useSyncExternalStore } from 'react'
import { getVersion, subscribe } from '../state/store'

/** Re-renders the caller whenever the store changes. Components then re-read
 *  `getState()` directly rather than holding a copy that can go stale. */
export function useVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}
```

- [ ] **Step 4: Write the stylesheet**

`src/ui/matrix.css` — the sticky rules are the whole point; they are what make one matrix work on a phone.

```css
.mx-wrap {
  overflow: auto;
  max-height: 100vh;
  -webkit-overflow-scrolling: touch;
}

.mx {
  border-collapse: separate;
  border-spacing: 0;
  font: 11px/1.4 system-ui, sans-serif;
}

.mx th,
.mx td {
  border-right: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
}

/* The frozen callsign column. `left: 0` plus a background is what stops the
   day cells showing through it while the grid scrolls sideways. */
.mx .who {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #fff;
  text-align: left;
  min-width: 84px;
}

/* The sticky date header. z-index 3 so the corner cell wins over both. */
.mx thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f5f5f5;
}

.mx thead th.who {
  z-index: 3;
}

.mx .day {
  min-width: 30px;
}

.mx .blocked {
  background: #FFA500;
}

.mx .weekend {
  background: #f0f0f0;
}

.mx td.duty {
  background: #FFFF00;
}

.mx td.gone {
  background: #e8e8e8;
  color: #999;
}

.mx .cat {
  color: #666;
  font-size: 10px;
  padding-left: 6px;
}
```

- [ ] **Step 5: Write the component**

`src/ui/Matrix.tsx`:

```tsx
import { categoryOf, codeOf, inSquadron } from '../engine'
import { getState } from '../state/store'
import { useVersion } from './useStore'
import './matrix.css'

export function Matrix() {
  useVersion()
  const { people, period, grid } = getState()

  return (
    <div className="mx-wrap">
      <table className="mx">
        <thead>
          <tr>
            <th className="who">Callsign</th>
            {period.days.map(d => (
              <th
                key={d.date}
                data-testid={`head-${d.date}`}
                className={`day${d.blocked ? ' blocked' : ''}`}
                title={d.blocked ? d.blockedReason : d.events.filter(Boolean).join(' / ')}
              >
                {d.date.slice(8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map(p => (
            <tr key={p.id} data-testid={`row-${p.id}`}>
              <td className="who">
                {p.callsign}
                <span className="cat">{categoryOf(p)}</span>
              </td>
              {period.days.map(d => {
                const code = grid[p.id]?.[d.date] ?? ''
                const here = inSquadron(p, d.date)
                const cls = [
                  here ? '' : 'gone',
                  codeOf(code)?.duty ? 'duty' : '',
                ].filter(Boolean).join(' ')
                return (
                  <td key={d.date} data-testid={`cell-${p.id}-${d.date}`} className={cls}>
                    {here ? code : 'PO'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Mount it**

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initStore } from './state/store'
import { Matrix } from './ui/Matrix'

initStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Matrix />
  </StrictMode>,
)
```

- [ ] **Step 7: Run tests and build**

Run: `npx vitest run src/ui/matrix.test.tsx && npm run build`
Expected: PASS, 6 tests; build clean.

- [ ] **Step 8: Commit**

```bash
git add src/ui/ src/main.tsx
git commit -m "feat(ui): the matrix with a frozen callsign column"
```

---

### Task 11: Manning count rows

**Files:**
- Create: `src/ui/CountRows.tsx`
- Modify: `src/ui/Matrix.tsx`, `src/ui/matrix.css`
- Test: `src/ui/counts.test.tsx`

**Interfaces:**
- Consumes: `evaluatePeriod`, `DayVerdict` from `../engine`; `getState` from `../state/store`
- Produces: `<CountRows verdicts={…} />`

One row per rule, sitting between the date header and the people. Amber and red live here; orange lives on the date header above. They never compete because they are on different rows.

- [ ] **Step 1: Write the failing test**

`src/ui/counts.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { initStore, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('count rows', () => {
  it('shows one row per rule plus the set rule', () => {
    render(<Matrix />)
    expect(screen.getByTestId('count-sets')).toBeTruthy()
    expect(screen.getByTestId('count-ip')).toBeTruthy()
    expect(screen.getByTestId('count-sxo')).toBeTruthy()
  })

  it('shows the available figure for a day', () => {
    render(<Matrix />)
    // Three IPs seeded (TATA, MILES, RESET). TATA is on FS on 1 Jan, and SC
    // duty is at work but off the flying programme, so two remain available.
    expect(screen.getByTestId('count-ip-2026-01-01').textContent).toBe('2')
  })

  it('counts a half day as a half, which the spreadsheet could not', () => {
    setCell('cross', '2026-02-05', 'AM')
    render(<Matrix />)
    expect(screen.getByTestId('count-opsw-2026-02-05').textContent).toBe('4.5')
  })

  it('paints a breached count red', () => {
    for (const id of ['tata', 'miles', 'reset']) setCell(id, '2026-02-05', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).toContain('red')
  })

  it('paints a thin but unbroken count amber', () => {
    setCell('tata', '2026-02-05', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).toContain('amber')
  })

  it('leaves a healthy count unpainted', () => {
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).not.toMatch(/amber|red/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/counts.test.tsx`
Expected: FAIL — no `count-sets` element.

- [ ] **Step 3: Write the component**

`src/ui/CountRows.tsx`:

```tsx
import type { DayVerdict } from '../engine'

/** Rounds for display only — 4.5 stays 4.5, 4 does not become "4.0". */
const show = (n: number) => String(Math.round(n * 10) / 10)

export function CountRows({ verdicts, dates }: { verdicts: Record<string, DayVerdict>; dates: string[] }) {
  // `requirementFor` can swap in a wholly different rule set per date via
  // `overrides[date]` — nothing constrains an override's rules to the same
  // length or order as the default. So the row set is built by walking
  // every date's results (not just the first) and keeping the first label
  // seen per ruleId, and each cell is looked up by ruleId, never by array
  // position — a reordered or date-only rule must still land in its own
  // row, not silently under someone else's label.
  const rows: { ruleId: string; label: string }[] = []
  const seen = new Set<string>()
  for (const date of dates) {
    for (const r of verdicts[date]?.results ?? []) {
      if (!seen.has(r.ruleId)) {
        seen.add(r.ruleId)
        rows.push({ ruleId: r.ruleId, label: r.label })
      }
    }
  }
  if (rows.length === 0) return null

  // One lookup map per date, built once, so each cell is a ruleId lookup
  // rather than a per-cell `find` over that date's results array.
  const byDate = new Map(dates.map(date => [date, new Map(verdicts[date]?.results.map(r => [r.ruleId, r]))]))

  return (
    <tbody className="counts">
      {rows.map(({ ruleId, label }) => (
        <tr key={ruleId} data-testid={`count-${ruleId}`}>
          <td className="who">{label}</td>
          {dates.map(date => {
            const r = byDate.get(date)?.get(ruleId)
            if (!r) return <td key={date} />
            return (
              <td
                key={date}
                data-testid={`count-${ruleId}-${date}`}
                className={r.verdict === 'ok' ? '' : r.verdict}
                title={`${label}: ${show(r.have)} available, amber ${r.amber}, red ${r.red}`}
              >
                {show(r.have)}
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  )
}
```

Two tests pin this, written against `CountRows` directly rather than through
`Matrix` — the store seeds `overrides: {}` and offers no way to set one, so a
component-level test is the honest way to reach the case. One renders two dates
whose `results` arrays are in **different orders** and asserts each figure lands
in its own rule's row; the other has the later date **missing** a rule the first
carries, asserting that cell is blank and no other row shifts.

- [ ] **Step 4: Add the verdict colours**

Append to `src/ui/matrix.css`:

```css
.mx .counts td.amber {
  background: #FFBF00;
}

.mx .counts td.red {
  background: #FF0000;
  color: #fff;
}

.mx .counts td {
  font-weight: 600;
}
```

- [ ] **Step 5: Wire it into the matrix**

In `src/ui/Matrix.tsx`, add the imports:

```tsx
import { evaluatePeriod } from '../engine'
import { CountRows } from './CountRows'
```

Widen the existing destructure rather than calling `getState()` a second time, then derive the verdicts:

```tsx
const { people, period, grid, requirements } = getState()
const dates = period.days.map(d => d.date)
const verdicts = evaluatePeriod(people, grid, requirements, dates)
```

Then insert between `</thead>` and `<tbody>`:

```tsx
<CountRows verdicts={verdicts} dates={dates} />
```

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all suites PASS; build clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): live manning count rows with amber and red verdicts"
```

---

### Task 12: The real-browser geometry gate

**Files:**
- Create: `playwright.config.ts`, `e2e/matrix.spec.ts`
- Modify: `package.json` (no change needed if Task 1's `test:e2e` script is present)

**Interfaces:**
- Consumes: the built bundle
- Produces: a CI-able gate over the matrix's layout on a phone

A test runner with no layout engine reports every rectangle as 0×0. It can prove which class was emitted and nothing about what was painted — so a frozen column that has come unstuck, or a header that scrolls away, passes the unit suite all day. The matrix on a phone is the riskiest surface in this build, and this is the only thing that can see it.

- [ ] **Step 1: Write the config**

`playwright.config.ts`:

```ts
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
    // devices['iPhone 13'] defaults to browserName 'webkit', and this image
    // ships only a Chromium build — transcribed verbatim, every phone test
    // dies at browser launch before a single assertion runs. Forcing
    // chromium keeps the iPhone viewport, touch, UA and scale factor.
    // Known limitation: the phone project therefore exercises Blink, not
    // the engine real iPhones run, and table `position: sticky` is exactly
    // where the two have historically differed.
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
```

- [ ] **Step 2: Write the geometry test**

`e2e/matrix.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run the gate**

Run: `npm run test:e2e`
Expected: PASS on both the phone and desktop projects.

If a scroll assertion fails on the phone project only, the cause is almost always a `position: sticky` ancestor with `overflow` set — check `.mx-wrap` is the only scroller.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test(e2e): geometry gate for the matrix on a phone and desktop"
```

---

## Self-review notes

Checked against the spec:

- **Roster, derived categories, SXO, posting dates** — Tasks 3, 8.
- **Day codes with four facts, fractional removal, duty separated** — Tasks 2, 6.
- **Period, events, blocked days, public holidays** — Tasks 4, 8.
- **Sets and category minimums, amber/red, period default with day overrides** — Tasks 5, 7.
- **One matrix on every device, frozen column, sticky header, the colour set** — Tasks 10, 11, 12.
- **Engine DOM-free, storage behind one seam** — Tasks 2–8 (no React import anywhere), Task 9.

Deliberately **not** in this plan, each needing its own: bid states and the cycle's stages; approval; counters, balances and the ledger; automatic OIL from an approved schedule; the rules editor; the shared backend.

The spec's `stage` field is defined in Task 4 and seeded as `open` in Task 8 but nothing reads it yet — that is intentional, and the bidding plan is what gives it meaning.
