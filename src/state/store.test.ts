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
