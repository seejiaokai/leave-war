// The store. `setCell` is the ONLY path that writes a cell: it updates the
// grid AND that cell's bid state, persists through the backend, bumps the
// version and notifies. A write that skips it is invisible to the interface
// and is never saved.

import {
  isBiddable,
  nextStage,
  seedGrid,
  seedPeople,
  seedPeriod,
  seedRequirements,
  seedStates,
  STAGE_ORDER,
  type BidRecord,
  type BidSource,
  type BidState,
  type Grid,
  type Period,
  type Person,
  type Requirements,
  type Stage,
  type States,
} from '../engine'
import { localBackend, memoryBackend, type StorageBackend } from './storage'

interface State {
  people: Person[]
  period: Period
  requirements: Requirements
  grid: Grid
  states: States
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
    states: seedStates(),
  }
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

// A grid is a plain object of plain objects of strings: personId -> date ->
// code. Checking only the top level lets a shape like `{"ramp":{"...":123}}`
// through, which then crashes on boot inside codeOf (which expects a
// string). The guard's job is to degrade to the seed instead, same as every
// other malformed shape.
function isValidGrid(x: unknown): x is Grid {
  if (!isPlainObject(x)) return false
  for (const row of Object.values(x)) {
    if (!isPlainObject(row)) return false
    for (const code of Object.values(row)) {
      if (typeof code !== 'string') return false
    }
  }
  return true
}

const BID_STATES = new Set(['pending', 'approved', 'refused'])
const BID_SOURCES = new Set(['bid', 'raptor'])

/**
 * Read one stored leaf into a `BidRecord`, or `null` if it is not one.
 *
 * Two shapes are accepted. The record is what is written today. A bare
 * string is what earlier builds wrote, and it is MIGRATED rather than
 * rejected: bids already sitting in someone's browser predate sources
 * entirely, and degrading them to the seed would silently throw away real
 * decisions to gain nothing. A string could only ever have meant a bid the
 * squadron placed here, so `source: 'bid'` is a fact, not a guess.
 */
function readRecord(leaf: unknown): BidRecord | null {
  if (typeof leaf === 'string') {
    return BID_STATES.has(leaf) ? { state: leaf as BidState, source: 'bid' } : null
  }
  if (!isPlainObject(leaf)) return null
  const { state, source, shiftedFrom } = leaf
  if (typeof state !== 'string' || !BID_STATES.has(state)) return null
  if (typeof source !== 'string' || !BID_SOURCES.has(source)) return null
  if (shiftedFrom !== undefined && typeof shiftedFrom !== 'string') return null
  const out: BidRecord = { state: state as BidState, source: source as BidSource }
  if (shiftedFrom !== undefined) out.shiftedFrom = shiftedFrom
  return out
}

// Same shape as a grid, but each leaf is a record rather than free text. A
// state nobody defined is not a state — it would flow straight into
// `removesAvailability`, where anything that is not exactly 'refused'
// silently removes a person.
//
// Unlike the grid guard this one CONVERTS as it validates, because the
// migration above has to happen somewhere and doing it here means every
// caller downstream sees one shape.
function readStates(x: unknown): States | null {
  if (!isPlainObject(x)) return null
  const out: States = {}
  for (const [id, row] of Object.entries(x)) {
    if (!isPlainObject(row)) return null
    const kept: Record<string, BidRecord> = {}
    for (const [date, leaf] of Object.entries(row)) {
      const record = readRecord(leaf)
      if (!record) return null
      kept[date] = record
    }
    out[id] = kept
  }
  return out
}

/** What the backend holds under `key`, or `null` if there is nothing usable
 *  there. `null` covers both "never written" and "written but unreadable" —
 *  the caller's answer to each is the same, which is to fall back. */
function read<T>(key: string, valid: (x: unknown) => x is T): T | null {
  return readStored(key, x => (valid(x) ? x : null))
}

/** As `read`, but the reader may CONVERT rather than merely accept — which
 *  is what the states migration needs. Returning `null` from `parse` means
 *  the stored value is unusable and the caller should fall back. */
function readStored<T>(key: string, parse: (x: unknown) => T | null): T | null {
  const raw = backend.read(key)
  if (!raw) return null
  try {
    return parse(JSON.parse(raw))
  } catch {
    return null
  }
}

// The parallel map's one real weakness is drift, and load is the one place
// drift can arrive from outside `setCell` — hand-edited storage, or data
// written by a build that predates bid states. So every stored state is
// checked against the cell it names and dropped if that cell no longer
// holds a code someone bids for: a stale 'approved' left on a cell that is
// now medical would colour it wrong, and one left on an empty cell would
// mean nothing at all.
function reconcile(grid: Grid, states: States): States {
  const out: States = {}
  for (const [id, row] of Object.entries(states)) {
    const kept: Record<string, BidRecord> = {}
    for (const [date, record] of Object.entries(row)) {
      if (isBiddable(grid[id]?.[date])) kept[date] = record
    }
    if (Object.keys(kept).length > 0) out[id] = kept
  }
  return out
}

export function initStore(b?: StorageBackend): void {
  backend = b ?? localBackend()
  state = blank()

  const storedGrid = read('grid', isValidGrid)
  state.grid = storedGrid ?? seedGrid()
  // Seed decisions belong to the seed grid and to nothing else. A stored
  // grid is the squadron's own data, and hanging seeded approvals off it
  // would approve cells nobody bid for.
  state.states = reconcile(state.grid, storedGrid ? readStored('states', readStates) ?? {} : seedStates())

  // Asked of STAGE_ORDER rather than compared against a second copy of the
  // four names, so a stage added to the cycle cannot become one this refuses
  // to reload. Anything else stored here is not a stage, and the seed's is a
  // better answer than a period stuck in a state nothing can leave.
  const storedStage = backend.read('stage') as Stage | null
  if (storedStage && STAGE_ORDER.includes(storedStage)) {
    state.period = { ...state.period, stage: storedStage }
  }

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

// One writer for all three keys, so no write path can save a grid and forget
// the states that have to agree with it.
function persist(): void {
  backend.write('grid', JSON.stringify(state.grid))
  backend.write('states', JSON.stringify(state.states))
  backend.write('stage', state.period.stage)
}

// A cell and its bid state are written together. Splitting them across two
// callers is how the two maps drift — a code with no state, or a state whose
// code has gone. This is the only function allowed to write either.
export function setCell(personId: string, date: string, code: string): void {
  const clean = code.trim().toUpperCase()
  const previous = state.grid[personId]?.[date]
  const row = { ...(state.grid[personId] ?? {}) }
  const srow = { ...(state.states[personId] ?? {}) }

  if (clean) row[date] = clean
  else delete row[date]

  if (!clean || !isBiddable(clean)) delete srow[date]
  // A code rewritten as ITSELF keeps whatever decision it already carries —
  // re-typing LL over an approved LL must not quietly un-approve it. A code
  // rewritten as a DIFFERENT one is a different ask, so it goes back to
  // pending AND loses any record of having been shifted: that provenance
  // belonged to the bid that has just been replaced.
  else if (clean !== previous || srow[date] === undefined) srow[date] = { state: 'pending', source: 'bid' }

  state = {
    ...state,
    grid: { ...state.grid, [personId]: row },
    states: { ...state.states, [personId]: srow },
  }
  persist()
  notify()
}

/** Record a decision on a bid. Deliberately not role-gated: there is no
 *  login in this prototype, so anyone can decide anything — see
 *  `docs/known-gaps.md`. */
export function setBidState(personId: string, date: string, bid: BidState): void {
  // A decision on a cell nobody bid for would be a state with no bid behind
  // it, which is exactly the drift `setCell` exists to prevent. Ignore it
  // rather than write it.
  if (!isBiddable(state.grid[personId]?.[date])) return
  // Deciding keeps the rest of the record — the source that wrote it, and
  // the date it was shifted from. Management approving a shifted bid is the
  // second half of that move, and losing the provenance at exactly the
  // moment the move completes would make the trail useless.
  const existing = state.states[personId]?.[date]
  const srow = {
    ...(state.states[personId] ?? {}),
    [date]: { ...(existing ?? { source: 'bid' as const }), state: bid },
  }
  state = { ...state, states: { ...state.states, [personId]: srow } }
  persist()
  notify()
}

/** Walk the period to its next stage. Forward only, and a no-op at the end
 *  of the cycle — `nextStage` owns which transitions exist. */
export function advanceStage(): void {
  const next = nextStage(state.period.stage)
  if (!next) return
  state = { ...state, period: { ...state.period, stage: next } }
  persist()
  notify()
}
