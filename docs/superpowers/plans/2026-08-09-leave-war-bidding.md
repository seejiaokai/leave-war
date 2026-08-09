# LEAVE WAR — Bidding, the Cycle Stages and Approval

> ## ✅ EXECUTED, 9 Aug 26 — kept for the reasoning, not as instructions
>
> All nine tasks are done and on `claude/bidding-plan-continuation-vqnrfz`,
> and a later branch has since moved past it again — bid states now carry a
> source and a shift record, `canBid` has become `canEdit(stage, role)`, and
> `States` holds a record rather than a bare state string.
>
> **Nearly every code block below is now stale.** Read
> `docs/superpowers/specs/2026-08-09-leave-war-design.md` for what is true and
> `docs/RESUME.md` for where things stand. This file is kept for its
> reasoning, not as a description of the code.

> ## ⚠ STALE IN FIVE PLACES — the notes that applied while executing
>
> This plan was written **before** the leave-code rework landed (9 Aug 26).
> `AM`, `PM`, `HO` and `HL` no longer exist as codes, and `CODES` is no longer
> exported. A cell is now a **leave type plus a portion**, written in the owner's
> notation: `OIL` whole day, `*OIL` morning, `OIL*` afternoon.
>
> Every line below is verified against the current engine. Fix each as you reach
> it, or the task fails for the wrong reason and you will waste a round chasing it.
>
> | Where | What is stale | Use instead |
> |---|---|---|
> | Task 1, `bids.test.ts` (line ~63) | `isBiddable('AM' \| 'PM' \| 'HO')` | `'*LL'`, `'LL*'`, `'*OIL'` |
> | Task 1, `bids.test.ts` (line ~69) | `'HL'` in the non-bid list | drop it — never a code, only part of what `M` covers |
> | Task 2, availability tests (lines ~208–209) | `availabilityOf(…, 'AM', …)` | `'*LL'`. The assertion stands: a half day removes exactly 0.5 |
> | Task 7, interfaces (line ~761) | consumes `CODES` | `LEAVE_TYPES` |
> | Task 7, `BidPicker.tsx` (lines ~830, ~837) | `Object.values(CODES).filter(…)` | offer **a leave type and a portion** separately — eight types, then whole day / morning / afternoon — and build the string with `formatCell` |
>
> The picker change is the substantive one: it is no longer a flat list of codes to
> click, it is two choices. Everything else is a rename.

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the squadron bid for leave against the live manning picture, and let management approve or refuse each bid, with the period moving through its stages.

**Architecture:** A bid is a code plus a state, kept as a `States` map parallel to the existing `Grid` and owned by the same mutation funnel so the two cannot drift. Availability learns that a refused bid removes nobody. Stage transitions live in the engine as a pure function so the UI cannot invent an illegal one.

**Tech Stack:** Unchanged — React 19, TypeScript, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-09-leave-war-design.md`
**Builds on:** `docs/superpowers/plans/2026-08-09-leave-war-foundation.md` (complete)

## Global Constraints

Every task's requirements implicitly include these.

- **Warn, never block.** No rule refuses a bid. A bid that breaks a manning rule is accepted with the breach shown. Management decides.
- **A pending bid counts as away** (owner, 9 Aug 26). The manning counts show the worst case — what manning becomes if every pending bid is granted — because that is what warns a scheduler early. **A refused bid removes nobody**: the person is working that day.
- **No authentication in this plan** (owner, 9 Aug 26). Bidding runs as a fixed current user and approval is not role-gated — anyone can approve. This is a deliberate consequence of deferring accounts to the backend, not an oversight. Do not build a login, a role check, or a permission gate; do not present the app as having one.
- **`src/engine/` stays DOM-free.** No React, no `document`, no `window`.
- **`setCell` remains the only path that writes a cell**, and it now owns bid-state consistency: a cell and its state are written and cleared together, never separately.
- Dates are `yyyy-mm-dd` strings. Availability is fractional. Nothing rounds.
- **The three bid colours already exist** in `src/ui/matrix.css` as `.c.appr`, `.c.tbc` and `.c.ref`, unused. This plan is what lights them up. Do not redefine them.
- Comments explain WHY, in prose, above the code.

---

### Task 1: The bid state model

**Files:**
- Create: `src/engine/bids.ts`
- Test: `src/engine/bids.test.ts`
- Modify: `src/engine/index.ts` (add the export line)

**Interfaces:**
- Consumes: `codeOf` from `./codes`
- Produces: `BidState`, `States`, `stateOf(states, personId, date)`, `isBiddable(code)`, `removesAvailability(code, state)`

- [x] **Step 1: Write the failing test**

`src/engine/bids.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isBiddable, removesAvailability, stateOf, type States } from './bids'

const states: States = { ramp: { '2026-01-05': 'approved', '2026-01-06': 'refused' } }

describe('stateOf', () => {
  it('returns the state where one is recorded', () => {
    expect(stateOf(states, 'ramp', '2026-01-05')).toBe('approved')
  })

  it('returns undefined where none is, without throwing on an unknown person', () => {
    expect(stateOf(states, 'ramp', '2026-01-09')).toBeUndefined()
    expect(stateOf(states, 'nobody', '2026-01-05')).toBeUndefined()
  })
})

describe('isBiddable', () => {
  it('is true for leave a person bids for', () => {
    for (const c of ['LL', 'OL', 'AM', 'PM', 'OIL', 'HO', 'CCL', 'EL']) {
      expect(isBiddable(c)).toBe(true)
    }
  })

  it('is false for medical, courses and duty — nobody bids for those', () => {
    for (const c of ['M', 'HL', 'CSE', 'OD', 'FS', 'HS']) expect(isBiddable(c)).toBe(false)
  })

  it('is false for an unknown or empty code', () => {
    expect(isBiddable('ZZZ')).toBe(false)
    expect(isBiddable('')).toBe(false)
  })
})

describe('removesAvailability', () => {
  it('removes for a pending bid — the counts show the worst case', () => {
    expect(removesAvailability('LL', 'pending')).toBe(true)
  })

  it('removes for an approved bid', () => {
    expect(removesAvailability('LL', 'approved')).toBe(true)
  })

  it('removes NOBODY for a refused bid — he is working that day', () => {
    expect(removesAvailability('LL', 'refused')).toBe(false)
  })

  it('removes for a non-bid code regardless of any stray state', () => {
    // Medical is not bid for, so a state should never exist; if one does,
    // it must not make a sick man count as available.
    expect(removesAvailability('M', undefined)).toBe(true)
    expect(removesAvailability('M', 'refused')).toBe(true)
  })

  it('removes for a bid code with no state recorded', () => {
    expect(removesAvailability('LL', undefined)).toBe(true)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/bids.test.ts`
Expected: FAIL — cannot resolve `./bids`.

- [x] **Step 3: Write the implementation**

`src/engine/bids.ts`:

```ts
// A bid is a code plus a state. The code lives in the Grid; the state lives
// here, in a parallel map keyed the same way.
//
// Why parallel rather than making a cell an object: the Grid's shape is what
// storage, the matrix and every engine consumer already read, and widening it
// would touch all of them for a field that only some cells have. The cost of
// the parallel map is that the two can drift, which is why `setCell` owns
// both and is the only thing allowed to write either.

import { codeOf } from './codes'

export type BidState = 'pending' | 'approved' | 'refused'

/** `personId -> date -> state`. Sparse: only bid cells appear. */
export type States = Record<string, Record<string, BidState>>

export function stateOf(states: States, personId: string, date: string): BidState | undefined {
  return states[personId]?.[date]
}

/** Whether a person bids for this code at all. Medical, courses and duty
 *  happen to someone; leave is asked for. */
export function isBiddable(code: string | undefined | null): boolean {
  return codeOf(code)?.bid ?? false
}

/** Whether this cell takes the person out of the manning picture.
 *
 *  A REFUSED bid removes nobody — he asked, he was told no, he is at work.
 *  A PENDING bid does remove: the counts show the worst case, what manning
 *  becomes if everything asked for is granted, because that is what warns a
 *  scheduler while there is still time to act (owner, 9 Aug 26).
 *
 *  A non-bid code always removes, whatever state may somehow be attached —
 *  a stray state must never make a sick man count as available. */
export function removesAvailability(code: string | undefined | null, state: BidState | undefined): boolean {
  if (!isBiddable(code)) return true
  return state !== 'refused'
}
```

Add to `src/engine/index.ts`, keeping the list alphabetical:

```ts
export * from './bids'
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/bids.test.ts`
Expected: PASS, 9 tests.

- [x] **Step 5: Commit**

```bash
git add src/engine/bids.ts src/engine/bids.test.ts src/engine/index.ts
git commit -m "feat(engine): bid states, and what a refused bid means for manning"
```

---

### Task 2: Availability honours the bid state

**Files:**
- Modify: `src/engine/availability.ts`, `src/engine/evaluate.ts`
- Test: `src/engine/availability.test.ts`, `src/engine/evaluate.test.ts`

**Interfaces:**
- Consumes: `States`, `stateOf`, `removesAvailability` from `./bids`
- Produces: `availabilityOf(person, date, code, state)`, `countsFor(people, grid, states, date)`, `evaluateDay(people, grid, states, reqs, date)`, `evaluatePeriod(people, grid, states, reqs, dates)`

This is a **breaking signature change**. Every existing caller passes `states`; the existing tests pass `{}` and must keep asserting exactly what they assert today. Do not weaken an assertion to accommodate the new parameter.

- [x] **Step 1: Write the failing tests**

Append to `src/engine/availability.test.ts`:

```ts
describe('availability and the bid state', () => {
  const someone = p('a', 'pilot', 'ops')

  it('removes a person whose bid is pending — the worst case is what warns', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL', 'pending')).toBe(0)
  })

  it('removes a person whose bid was approved', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL', 'approved')).toBe(0)
  })

  it('does NOT remove a person whose bid was refused — he is at work', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL', 'refused')).toBe(1)
  })

  it('refuses a half day back to a whole person, not half of one', () => {
    expect(availabilityOf(someone, '2026-01-05', 'AM', 'refused')).toBe(1)
    expect(availabilityOf(someone, '2026-01-05', 'AM', 'pending')).toBe(0.5)
  })

  it('keeps a sick man away whatever state is attached', () => {
    expect(availabilityOf(someone, '2026-01-05', 'M', 'refused')).toBe(0)
  })

  it('puts a refused person back into the counts', () => {
    const people = [p('op1', 'pilot', 'ops'), p('ow1', 'wso', 'ops')]
    const grid: Grid = { op1: { '2026-01-05': 'LL' } }
    expect(countsFor(people, grid, {}, '2026-01-05').byCategory.OPSP).toBe(0)
    const states: States = { op1: { '2026-01-05': 'refused' } }
    expect(countsFor(people, grid, states, '2026-01-05').byCategory.OPSP).toBe(1)
  })
})
```

Add the imports this needs at the top of that file: `import type { States } from './bids'`.

Append to `src/engine/evaluate.test.ts`:

```ts
describe('evaluateDay and the bid state', () => {
  it('lets a refusal pull a day back from red', () => {
    const grid: Grid = { ip1: { [D]: 'LL' }, ip2: { [D]: 'LL' } }
    expect(evaluateDay(people, grid, {}, reqs, D).results.find(r => r.ruleId === 'ip')!.verdict).toBe('red')
    const states = { ip1: { [D]: 'refused' as const } }
    expect(evaluateDay(people, grid, states, reqs, D).results.find(r => r.ruleId === 'ip')!.verdict).toBe('amber')
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/availability.test.ts src/engine/evaluate.test.ts`
Expected: FAIL — wrong argument counts and unknown parameters.

- [x] **Step 3: Change `availability.ts`**

Replace the `availabilityOf` and `countsFor` signatures and bodies. The duty short-circuit must still run before anything else, and the `inSquadron` guard on the duty tally must stay:

```ts
import { removesAvailability, stateOf, type BidState, type States } from './bids'

export function availabilityOf(
  p: Person,
  date: string,
  code: string | undefined,
  state?: BidState,
): number {
  if (!inSquadron(p, date)) return 0
  const c = codeOf(code)
  // An unknown code must not remove anyone. A typo should look wrong on
  // screen, not quietly delete a person from the manning picture.
  if (!c) return 1
  if (c.duty) return 0
  // A refused bid gives the whole person back, not the fraction the code
  // would have taken — he is at work all day, not half of one.
  if (!removesAvailability(code, state)) return 1
  return 1 - c.removes
}

export function countsFor(people: Person[], grid: Grid, states: States, date: string): DayCounts {
  // ...body unchanged except the availability call:
  //   const have = availabilityOf(p, date, code, stateOf(states, p.id, date))
}
```

- [x] **Step 4: Change `evaluate.ts`**

Thread `states` through both functions, immediately after `grid`:

```ts
export function evaluateDay(
  people: Person[],
  grid: Grid,
  states: States,
  reqs: Requirements,
  date: string,
): DayVerdict {
  const counts = countsFor(people, grid, states, date)
  // ...rest unchanged
}

export function evaluatePeriod(
  people: Person[],
  grid: Grid,
  states: States,
  reqs: Requirements,
  dates: string[],
): Record<string, DayVerdict> {
  const out: Record<string, DayVerdict> = {}
  for (const date of dates) out[date] = evaluateDay(people, grid, states, reqs, date)
  return out
}
```

- [x] **Step 5: Update every existing caller**

Pass `{}` in the existing engine tests and `seed.test.ts`. In `src/ui/Matrix.tsx` pass `states` from the store (Task 4 adds it; until then pass `{}` and fix it in Task 4 — note this in your report so the next task knows).

- [x] **Step 6: Run the full suite**

Run: `npx vitest run && npm run build`
Expected: all green. Every previously passing assertion must still pass unchanged.

- [x] **Step 7: Commit**

```bash
git add src/engine/ src/ui/
git commit -m "feat(engine): a refused bid removes nobody from the manning picture"
```

---

### Task 3: Stage transitions

**Files:**
- Create: `src/engine/stages.ts`
- Test: `src/engine/stages.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes: `Stage` from `./period`
- Produces: `STAGE_ORDER`, `nextStage(stage)`, `canBid(stage)`, `canDecide(stage)`, `stageLabel(stage)`

- [x] **Step 1: Write the failing test**

`src/engine/stages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canBid, canDecide, nextStage, stageLabel, STAGE_ORDER } from './stages'

describe('stage transitions', () => {
  it('runs draft to open to closed to published', () => {
    expect(STAGE_ORDER).toEqual(['draft', 'open', 'closed', 'published'])
    expect(nextStage('draft')).toBe('open')
    expect(nextStage('open')).toBe('closed')
    expect(nextStage('closed')).toBe('published')
  })

  it('stops at published — there is nowhere further to go', () => {
    expect(nextStage('published')).toBeNull()
  })
})

describe('what each stage allows', () => {
  it('accepts bids only while open', () => {
    expect(canBid('draft')).toBe(false)
    expect(canBid('open')).toBe(true)
    expect(canBid('closed')).toBe(false)
    expect(canBid('published')).toBe(false)
  })

  it('accepts decisions only once closed', () => {
    expect(canDecide('draft')).toBe(false)
    expect(canDecide('open')).toBe(false)
    expect(canDecide('closed')).toBe(true)
    expect(canDecide('published')).toBe(false)
  })

  it('has a label for every stage', () => {
    for (const s of STAGE_ORDER) expect(stageLabel(s)).toBeTruthy()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/stages.test.ts`
Expected: FAIL — cannot resolve `./stages`.

- [x] **Step 3: Write the implementation**

`src/engine/stages.ts`:

```ts
// The cycle a leave war moves through, and what each stage allows.
//
// Forward only. There is deliberately no way back: reopening a closed period
// would mean bids arriving against decisions already made, and the owner
// chose a cycle with stages precisely so that "why did this change after I
// bid" always has an answer. A period that needs reopening is a new period.

import type { Stage } from './period'

export const STAGE_ORDER: Stage[] = ['draft', 'open', 'closed', 'published']

const LABEL: Record<Stage, string> = {
  draft: 'DRAFT',
  open: 'OPEN FOR BIDDING',
  closed: 'BIDDING CLOSED',
  published: 'PUBLISHED',
}

export function nextStage(stage: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(stage)
  return i < 0 || i === STAGE_ORDER.length - 1 ? null : STAGE_ORDER[i + 1]
}

/** Bids are placed only while the period is open. */
export function canBid(stage: Stage): boolean {
  return stage === 'open'
}

/** Decisions are made once bidding has closed and the picture has frozen —
 *  not while bids are still arriving underneath them. */
export function canDecide(stage: Stage): boolean {
  return stage === 'closed'
}

export function stageLabel(stage: Stage): string {
  return LABEL[stage]
}
```

Add `export * from './stages'` to `src/engine/index.ts`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/stages.test.ts`
Expected: PASS, 5 tests.

- [x] **Step 5: Commit**

```bash
git add src/engine/stages.ts src/engine/stages.test.ts src/engine/index.ts
git commit -m "feat(engine): forward-only stage transitions and what each allows"
```

---

### Task 4: The store owns bids

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes: `States`, `BidState`, `isBiddable` from `../engine`
- Produces: `getState()` now carries `states`; `setBidState(personId, date, state)`, `advanceStage()`

`setCell` gains a second responsibility and it is the point of the design: **a cell and its state are written and cleared together.** A cell written with a biddable code becomes `pending`; a cell cleared, or overwritten with a non-bid code, loses its state. Nothing else may write `states`.

- [x] **Step 1: Write the failing test**

Append to `src/state/store.test.ts`:

```ts
describe('bids', () => {
  it('makes a new leave cell pending by itself', () => {
    setCell('ramp', '2026-02-02', 'LL')
    expect(getState().states.ramp['2026-02-02']).toBe('pending')
  })

  it('gives a non-bid code no state at all', () => {
    setCell('ramp', '2026-02-03', 'CSE')
    expect(getState().states.ramp?.['2026-02-03']).toBeUndefined()
  })

  it('drops the state when the cell is cleared', () => {
    setCell('ramp', '2026-02-04', 'LL')
    setCell('ramp', '2026-02-04', '')
    expect(getState().states.ramp?.['2026-02-04']).toBeUndefined()
  })

  it('drops the state when a bid is overwritten by a non-bid code', () => {
    setCell('ramp', '2026-02-05', 'LL')
    setCell('ramp', '2026-02-05', 'M')
    expect(getState().states.ramp?.['2026-02-05']).toBeUndefined()
  })

  it('keeps a decision when the same code is rewritten', () => {
    setCell('ramp', '2026-02-06', 'LL')
    setBidState('ramp', '2026-02-06', 'approved')
    setCell('ramp', '2026-02-06', 'LL')
    expect(getState().states.ramp['2026-02-06']).toBe('approved')
  })

  it('records a decision', () => {
    setCell('ramp', '2026-02-07', 'LL')
    setBidState('ramp', '2026-02-07', 'refused')
    expect(getState().states.ramp['2026-02-07']).toBe('refused')
  })

  it('bumps the version so the interface re-reads', () => {
    setCell('ramp', '2026-02-08', 'LL')
    const before = getVersion()
    setBidState('ramp', '2026-02-08', 'approved')
    expect(getVersion()).toBe(before + 1)
  })

  it('persists states and reloads them', () => {
    const backend = memoryBackend()
    initStore(backend)
    setCell('ramp', '2026-02-09', 'LL')
    setBidState('ramp', '2026-02-09', 'approved')
    initStore(backend)
    expect(getState().states.ramp['2026-02-09']).toBe('approved')
  })

  it('falls back to the seed states when stored states are unreadable', () => {
    const backend = memoryBackend()
    backend.write('states', 'not json')
    initStore(backend)
    expect(getState().states).toBeTypeOf('object')
    expect(Array.isArray(getState().states)).toBe(false)
  })
})

describe('advanceStage', () => {
  it('walks the period forward one stage at a time', () => {
    expect(getState().period.stage).toBe('open')
    advanceStage()
    expect(getState().period.stage).toBe('closed')
    advanceStage()
    expect(getState().period.stage).toBe('published')
  })

  it('stops at published rather than wrapping', () => {
    advanceStage(); advanceStage(); advanceStage()
    expect(getState().period.stage).toBe('published')
  })
})
```

Import `setBidState` and `advanceStage` alongside the existing imports.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — `setBidState` is not exported.

- [x] **Step 3: Implement**

In `src/state/store.ts`: add `states: States` to `State` and to `blank()` (seeded by `seedStates()`, which Task 5 adds — until then `{}`); add a `loadStates()` mirroring `loadGrid()`'s guard, validating a map of maps of the three known state strings; persist `states` alongside `grid` on every write.

```ts
// A cell and its bid state are written together. Splitting them across two
// callers is how the two maps drift — a code with no state, or a state whose
// code has gone. This is the only function allowed to write either.
export function setCell(personId: string, date: string, code: string): void {
  const clean = code.trim().toUpperCase()
  const row = { ...(state.grid[personId] ?? {}) }
  const srow = { ...(state.states[personId] ?? {}) }

  if (clean) row[date] = clean
  else delete row[date]

  if (!clean || !isBiddable(clean)) delete srow[date]
  // A code rewritten as itself keeps whatever decision it already carries —
  // re-typing LL over an approved LL must not quietly un-approve it.
  else if (srow[date] === undefined) srow[date] = 'pending'

  state = { ...state, grid: { ...state.grid, [personId]: row }, states: { ...state.states, [personId]: srow } }
  persist()
  notify()
}

export function setBidState(personId: string, date: string, bid: BidState): void {
  const srow = { ...(state.states[personId] ?? {}), [date]: bid }
  state = { ...state, states: { ...state.states, [personId]: srow } }
  persist()
  notify()
}

export function advanceStage(): void {
  const next = nextStage(state.period.stage)
  if (!next) return
  state = { ...state, period: { ...state.period, stage: next } }
  persist()
  notify()
}
```

Add a small `persist()` that writes both keys, so no write path can forget one.

- [x] **Step 4: Run tests**

Run: `npx vitest run src/state/store.test.ts && npx vitest run && npm run build`
Expected: all green.

- [x] **Step 5: Commit**

```bash
git add src/state/
git commit -m "feat(state): bids and stages, written through the one funnel"
```

---

### Task 5: Seed the three states

**Files:**
- Modify: `src/engine/seed.ts`, `src/engine/index.ts` (no change if the barrel already re-exports seed)
- Test: `src/engine/seed.test.ts`

**Interfaces:**
- Produces: `seedStates(): States`

The screen must show all three bid colours on first run, or nobody can judge the design. Seed states for cells that already exist in `seedGrid()` — never for a cell that does not.

- [x] **Step 1: Write the failing test**

Append to `src/engine/seed.test.ts`:

```ts
describe('seedStates', () => {
  it('shows all three states so the screen exercises every colour', () => {
    const seen = new Set(Object.values(seedStates()).flatMap(r => Object.values(r)))
    expect(seen).toEqual(new Set(['pending', 'approved', 'refused']))
  })

  it('never records a state for a cell that has no code', () => {
    const grid = seedGrid()
    for (const [id, row] of Object.entries(seedStates())) {
      for (const date of Object.keys(row)) {
        if (!grid[id]?.[date]) throw new Error(`state with no code: ${id} ${date}`)
      }
    }
    expect(Object.keys(seedStates()).length).toBeGreaterThan(0)
  })

  it('never records a state for a code nobody bids for', () => {
    const grid = seedGrid()
    for (const [id, row] of Object.entries(seedStates())) {
      for (const date of Object.keys(row)) {
        if (!isBiddable(grid[id][date])) throw new Error(`state on a non-bid code: ${id} ${date}`)
      }
    }
    expect(Object.keys(seedStates()).length).toBeGreaterThan(0)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/seed.test.ts`
Expected: FAIL — `seedStates` is not exported.

- [x] **Step 3: Implement**

Append to `src/engine/seed.ts`:

```ts
// Enough of each state that the matrix shows all three colours on first run.
// Every entry here must name a cell that seedGrid() actually holds, and a
// code someone would bid for — a state on a cell with no code is a bug the
// tests above will catch.
export function seedStates(): States {
  return {
    ramp: { '2026-01-01': 'approved', '2026-02-10': 'pending' },
    tata: { '2026-01-09': 'approved' },
    jaguar: { '2026-01-16': 'approved', '2026-01-17': 'approved', '2026-01-19': 'refused' },
    asics: { '2026-01-08': 'approved', '2026-01-09': 'refused', '2026-01-23': 'pending' },
    miles: { '2026-02-02': 'pending', '2026-02-03': 'pending' },
    roulette: { '2026-01-15': 'approved' },
    cross: { '2026-03-10': 'refused' },
  }
}
```

- [x] **Step 4: Run tests**

Run: `npx vitest run src/engine/seed.test.ts && npx vitest run`
Expected: all green.

- [x] **Step 5: Commit**

```bash
git add src/engine/seed.ts src/engine/seed.test.ts
git commit -m "feat(engine): seed all three bid states so every colour renders"
```

---

### Task 6: The matrix shows bid state

**Files:**
- Modify: `src/ui/Matrix.tsx`
- Test: `src/ui/matrix.test.tsx`

**Interfaces:**
- Consumes: `stateOf`, `isBiddable` from `../engine`; `states` from the store

- [x] **Step 1: Write the failing test**

Append to `src/ui/matrix.test.tsx`:

```ts
describe('bid state on a cell', () => {
  it('paints an approved bid green, a pending one purple, a refused one red', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-jaguar-2026-01-16').querySelector('.c')!.className).toContain('appr')
    expect(screen.getByTestId('cell-asics-2026-01-23').querySelector('.c')!.className).toContain('tbc')
    expect(screen.getByTestId('cell-jaguar-2026-01-19').querySelector('.c')!.className).toContain('ref')
  })

  it('leaves a code nobody bids for as plain information', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-tata-2026-01-01').querySelector('.c')!.className).toContain('sc')
    expect(screen.getByTestId('cell-pipper-2026-01-12').querySelector('.c')!.className).toContain('info')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/matrix.test.tsx`
Expected: FAIL — no `appr` class.

- [x] **Step 3: Implement**

In `Matrix.tsx`, read `states` from `getState()`, pass it to `evaluatePeriod`, and replace the `chipState` derivation:

```tsx
// Duty first — FS/HS are work, not a bid, and must never read as one.
// Then the bid state where the code is one a person bids for. Everything
// else is plain information: medical, a course, overseas duty.
const bid = stateOf(states, p.id, d.date)
const chipState = !here || !code
  ? ''
  : isDuty(code) ? 'sc'
  : isBiddable(code) && bid === 'approved' ? 'appr'
  : isBiddable(code) && bid === 'refused' ? 'ref'
  : isBiddable(code) ? 'tbc'
  : 'info'
```

- [x] **Step 4: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all green.

- [x] **Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): paint the bid state on every cell"
```

---

### Task 7: Placing a bid

**Files:**
- Create: `src/ui/BidPicker.tsx`
- Modify: `src/ui/Matrix.tsx`, `src/ui/matrix.css`
- Test: `src/ui/bidding.test.tsx`

**Interfaces:**
- Consumes: `canBid`, `CODES`, `isBiddable` from `../engine`; `setCell` from the store
- Produces: `<BidPicker personId date onClose />`

While the period is open, clicking a cell opens a small picker of the codes a person bids for; choosing one writes the cell, which makes it pending. Choosing "Clear" empties it. Outside `open`, clicking a cell does nothing.

Bidding runs as a **fixed current user** — there is no login (see Global Constraints). Use the first person in the roster as "me", read from the store, and name it `ME` with a comment saying it is a stand-in for a real session.

- [x] **Step 1: Write the failing test**

`src/ui/bidding.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceStage, getState, initStore } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => { initStore(memoryBackend()) })

describe('placing a bid', () => {
  it('opens a picker on a cell while the period is open', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })

  it('writes the chosen code and makes it pending', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().states.dusk['2026-02-11']).toBe('pending')
  })

  it('clears a cell', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-clear'))
    expect(getState().grid.dusk?.['2026-02-11']).toBeUndefined()
  })

  it('offers only codes a person actually bids for', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('bid-FS')).toBeNull()
    expect(screen.queryByTestId('bid-CSE')).toBeNull()
    expect(screen.getByTestId('bid-OL')).toBeTruthy()
  })

  it('does nothing once bidding has closed', () => {
    advanceStage() // open -> closed
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/bidding.test.tsx`
Expected: FAIL — no `bid-picker`.

- [x] **Step 3: Write `BidPicker.tsx`**

```tsx
import { CODES, isBiddable } from '../engine'
import { setCell } from '../state/store'

/** The codes a person bids for, in catalogue order. Duty, medical and
 *  courses are deliberately absent — those happen to someone, they are not
 *  asked for, and offering them here would invite a scheduler's data to be
 *  typed as a bid. */
const BIDDABLE = Object.values(CODES).filter(c => isBiddable(c.code))

export function BidPicker({ personId, date, onClose }: { personId: string; date: string; onClose: () => void }) {
  const pick = (code: string) => { setCell(personId, date, code); onClose() }
  return (
    <div className="bidpop" data-testid="bid-picker" role="dialog" aria-label="Place a bid">
      <div className="bidpop-hd">{date}</div>
      <div className="bidpop-body">
        {BIDDABLE.map(c => (
          <button key={c.code} data-testid={`bid-${c.code}`} onClick={() => pick(c.code)} title={c.label}>
            {c.code}
          </button>
        ))}
        <button data-testid="bid-clear" className="clear" onClick={() => pick('')}>Clear</button>
      </div>
    </div>
  )
}
```

- [x] **Step 4: Wire it into `Matrix.tsx`**

Hold `const [picking, setPicking] = useState<{ id: string; date: string } | null>(null)`. On a cell's `onClick`, open the picker only when `canBid(period.stage)`. Render `<BidPicker>` when `picking` is set. Style `.bidpop` in `matrix.css` using the existing panel tokens — `--panel`, `--edge`, `--r` — so it matches the rest.

- [x] **Step 5: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all green.

- [x] **Step 6: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): place and clear a bid while the period is open"
```

---

### Task 8: Deciding, and moving the period on

**Files:**
- Modify: `src/ui/Matrix.tsx`, `src/ui/Chrome.tsx`, `src/ui/matrix.css`
- Test: `src/ui/deciding.test.tsx`

**Interfaces:**
- Consumes: `canDecide`, `nextStage`, `stageLabel` from `../engine`; `setBidState`, `advanceStage` from the store

Once bidding has closed, clicking a pending cell offers Approve and Refuse. The chrome grows a control that walks the period to its next stage, disabled at published.

**No role check** — see Global Constraints. Anyone can decide. Do not add a permission gate or imply one exists.

- [x] **Step 1: Write the failing test**

`src/ui/deciding.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceStage, getState, initStore } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Chrome } from './Chrome'
import { Matrix } from './Matrix'

beforeEach(() => { initStore(memoryBackend()) })

describe('deciding a bid', () => {
  it('offers nothing while bidding is still open', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-asics-2026-01-23'))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
  })

  it('approves a pending bid once closed', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-asics-2026-01-23'))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(getState().states.asics['2026-01-23']).toBe('approved')
  })

  it('refuses a pending bid, and the man returns to the counts', () => {
    advanceStage()
    render(<Matrix />)
    const before = screen.getByTestId('count-opsp-2026-01-23').textContent
    fireEvent.click(screen.getByTestId('cell-asics-2026-01-23'))
    fireEvent.click(screen.getByTestId('decide-refuse'))
    expect(getState().states.asics['2026-01-23']).toBe('refused')
    expect(screen.getByTestId('count-opsp-2026-01-23').textContent).not.toBe(before)
  })

  it('offers nothing on a cell nobody bid for', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-pipper-2026-01-12'))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
  })
})

// The stage control lives in the chrome, not the matrix, so this block
// renders Chrome — rendering Matrix would find no button and the test would
// fail for the wrong reason.
describe('moving the period on', () => {
  it('walks the stage forward and stops at published', () => {
    render(<Chrome />)
    expect(getState().period.stage).toBe('open')
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(getState().period.stage).toBe('closed')
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(getState().period.stage).toBe('published')
    expect(screen.getByTestId('stage-advance').hasAttribute('disabled')).toBe(true)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/deciding.test.tsx`
Expected: FAIL — no `decide-approve`.

- [x] **Step 3: Implement**

Extend the cell click: when `canDecide(stage)` and the cell carries a bid state, open a decision popover with two buttons calling `setBidState`. Reuse the `.bidpop` styling. In `Chrome.tsx` add a button rendering `stageLabel(nextStage(stage))` — disabled when `nextStage` is null — calling `advanceStage`.

The stage control must live where the stage is already shown, so the strip reads as one thing rather than a label and an unrelated button.

- [x] **Step 4: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all green.

- [x] **Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): approve or refuse a bid, and walk the period forward"
```

---

### Task 9: The browser gate

**Files:**
- Modify: `e2e/matrix.spec.ts`

- [x] **Step 1: Write the failing tests**

Append:

```ts
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
```

- [x] **Step 2: Run the gate**

Run: `npm run test:e2e`
Expected: the two new tests fail before Tasks 6–8 land, pass after.

- [x] **Step 3: Check the node ceiling**

The picker adds nodes only while open. Measure `.mx *` and confirm it is under the ceiling; if the ceiling needs raising, do it deliberately with the new measured figure and the date in the comment.

- [x] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test(e2e): the three bid colours differ, and a bid can be placed"
```

---

## Self-review notes

Checked against the spec:

- **Bid states, the squadron's three colours** — Tasks 1, 5, 6, 9.
- **A pending bid counts as away; a refused one removes nobody** — Tasks 1, 2.
- **Cycle with stages, forward only** — Tasks 3, 4, 8.
- **Warn, never block** — no task adds a refusal path; bidding is unconditional.
- **The mutation funnel stays single** — Task 4 gives `setCell` the state as well, rather than adding a second writer.

Deliberately **not** here, each needing its own plan: counters, balances and the OIL ledger; automatic OIL from an approved schedule; the rules editor; the shared backend; authentication and roles.

**Known consequence of deferring auth** (owner's decision, 9 Aug 26): approval is unguarded — anyone using the prototype can approve or refuse any bid, and "me" is a fixed roster entry rather than a signed-in person. This is recorded in `docs/known-gaps.md` and must not be presented as a security model.
