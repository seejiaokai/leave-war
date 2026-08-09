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

function loadGrid(): Grid {
  const raw = backend.read('grid')
  if (!raw) return seedGrid()
  try {
    const parsed = JSON.parse(raw)
    // Anything that is not a valid grid shape is unusable; the seed is a
    // better answer than a crash on boot.
    if (!isValidGrid(parsed)) return seedGrid()
    return parsed
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
