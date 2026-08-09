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
