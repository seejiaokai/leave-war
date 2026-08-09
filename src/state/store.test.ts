import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getState, getVersion, initStore, setCell, subscribe } from './store'
import { localBackend, memoryBackend } from './storage'

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
    // Asserted against a seed-only value, same as the shapes below — a
    // fallback to `{}` would otherwise pass this just as easily.
    expect(getState().grid.ramp?.['2026-01-01']).toBe('OL')
  })

  // A grid whose top level is a plain object but whose rows are not objects
  // of strings (e.g. a numeric cell) used to pass the old top-level-only
  // guard, then crash on boot inside codeOf, which expects a string. The
  // guard's job is to degrade to the seed here exactly as it does above.
  it('falls back to the seed when a grid row is not a plain object of strings', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"ramp":{"2026-01-01":123}}')
    initStore(backend)
    expect(getState().grid.ramp?.['2026-01-01']).toBe('OL')
  })

  // The three shapes below all parse as valid JSON but are not a plain
  // object, so each must be caught by the `typeof !== 'object' ||
  // Array.isArray` guard rather than the try/catch (which only sees
  // JSON.parse throw). Each is asserted against a seed-only value
  // ('ramp' → 'OL' on 2026-01-01, per seedGrid) so a fallback to `{}`
  // would not accidentally pass.
  it.each([
    ['an array', '[]'],
    ['null', 'null'],
    ['a bare primitive', '42'],
  ])('falls back to the seed when the backend holds %s as the grid', (_label, raw) => {
    const backend = memoryBackend()
    backend.write('grid', raw)
    initStore(backend)
    expect(getState().grid).toBeTypeOf('object')
    expect(Array.isArray(getState().grid)).toBe(false)
    expect(getState().grid.ramp?.['2026-01-01']).toBe('OL')
  })
})

describe('localBackend', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads back what it writes through real localStorage', () => {
    const backend = localBackend()
    backend.write('grid', '{"ramp":{"2026-01-20":"LL"}}')
    expect(backend.read('grid')).toBe('{"ramp":{"2026-01-20":"LL"}}')
  })

  // Private browsing and disabled storage both throw on any localStorage
  // access, not just on write. A leave war that cannot persist should still
  // open and read, so the backend must swallow the throw rather than take
  // the page down.
  it('degrades instead of throwing when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    const backend = localBackend()
    expect(backend.read('grid')).toBeNull()
    expect(() => backend.write('grid', 'x')).not.toThrow()
  })
})

describe('initStore subscriber contract', () => {
  // Deliberate, not a bug: initStore() represents a fresh boot of the store
  // (a new backend, a reset version, a clean slate), so it drops all
  // subscribers rather than carrying old ones into the new session. The
  // hazard is that calling initStore() after a component has mounted and
  // subscribed will silently strand that subscriber — no error, no signal,
  // it just stops receiving updates. Any change to this behaviour should be
  // deliberate, which is what this test pins down.
  it('drops subscribers registered before a later initStore call', () => {
    const fn = vi.fn()
    subscribe(fn)
    initStore(memoryBackend())
    setCell('ramp', '2026-01-25', 'LL')
    expect(fn).not.toHaveBeenCalled()
  })
})
