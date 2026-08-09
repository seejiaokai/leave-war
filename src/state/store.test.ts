import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceStage, getState, getVersion, initStore, setBidState, setCell, subscribe } from './store'
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

describe('bids', () => {
  it('makes a new leave cell pending by itself', () => {
    setCell('ramp', '2026-02-02', 'LL')
    expect(getState().states.ramp['2026-02-02']?.state).toBe('pending')
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
    expect(getState().states.ramp['2026-02-06']?.state).toBe('approved')
  })

  // Changing WHAT was asked for is a new ask. Re-typing LL over an approved
  // LL keeps the approval (above); turning it into OL must not inherit one —
  // nobody approved a week overseas.
  it('resets the decision when the bid is changed to different leave', () => {
    setCell('ramp', '2026-02-06', 'LL')
    setBidState('ramp', '2026-02-06', 'approved')
    setCell('ramp', '2026-02-06', 'OL')
    expect(getState().states.ramp['2026-02-06']?.state).toBe('pending')
  })

  it('records a decision', () => {
    setCell('ramp', '2026-02-07', 'LL')
    setBidState('ramp', '2026-02-07', 'refused')
    expect(getState().states.ramp['2026-02-07']?.state).toBe('refused')
  })

  // The one invariant the parallel map exists to keep: a state never lives
  // on a cell nobody bid for. setCell enforces it; so must setBidState.
  it('refuses to decide a cell nobody bid for', () => {
    setCell('ramp', '2026-02-12', 'CSE')
    setBidState('ramp', '2026-02-12', 'approved')
    expect(getState().states.ramp?.['2026-02-12']).toBeUndefined()
    setBidState('ramp', '2026-02-13', 'approved')
    expect(getState().states.ramp?.['2026-02-13']).toBeUndefined()
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
    expect(getState().states.ramp['2026-02-09']?.state).toBe('approved')
  })

  // States are seeded only alongside a seeded grid, so with no grid stored
  // the states key is not consulted at all — whatever it holds. This pins
  // the pairing rule, not the validator; the validator is exercised below,
  // where a stored grid makes the states key actually load.
  it('seeds the states when nothing usable is stored, whatever the states key holds', () => {
    const backend = memoryBackend()
    backend.write('states', 'not json')
    initStore(backend)
    expect(getState().states).toBeTypeOf('object')
    expect(Array.isArray(getState().states)).toBe(false)
    // Asserted against a seed-only value, same as the grid fallbacks above —
    // a fallback to `{}` would otherwise pass this just as easily.
    expect(getState().states.jaguar?.['2026-01-19']?.state).toBe('refused')
  })

  // The last two shapes name a cell the stored grid really holds and really
  // is a bid, so an accepted value would survive `reconcile` and land in
  // `states` — that is what makes them bite instead of passing vacuously
  // through the pruning, and they were rewritten to this form after the
  // first draft was found to pass with the leaf check removed.
  //
  // `null` and `[]` are weaker on purpose and worth knowing as such: each is
  // already caught before the leaf check (the try/catch, and pruning to an
  // empty map respectively), so they pin the observable behaviour without
  // isolating the plain-object guard. That guard is belt-and-braces here.
  it.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a leaf that is not a string', '{"jaguar":{"2026-01-19":123}}'],
    ['a state string nobody defined', '{"jaguar":{"2026-01-19":"maybe"}}'],
  ])('discards stored states that are %s, keeping the stored grid', (_label, raw) => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-19":"OL"}}')
    backend.write('states', raw)
    initStore(backend)
    expect(getState().grid.jaguar['2026-01-19']).toBe('OL')
    expect(getState().states.jaguar?.['2026-01-19']).toBeUndefined()
  })

  it('keeps stored states that are well formed', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-19":"OL"}}')
    backend.write('states', '{"jaguar":{"2026-01-19":"refused"}}')
    initStore(backend)
    expect(getState().states.jaguar['2026-01-19']?.state).toBe('refused')
  })

  // The parallel map's one weakness is drift, and load is where it can
  // arrive from outside setCell — hand-edited storage, or data written by a
  // build that predates states. A state whose cell no longer holds a code
  // someone bid for is dropped rather than left to colour a cell that is
  // now medical, or to remove a man who has no leave booked at all.
  it('drops a stored state whose code has gone or is no longer a bid', () => {
    const backend = memoryBackend()
    backend.write('grid', JSON.stringify({ ramp: { '2026-01-05': 'M' } }))
    backend.write('states', JSON.stringify({
      ramp: { '2026-01-05': 'approved', '2026-01-06': 'approved' },
    }))
    initStore(backend)
    expect(getState().states.ramp?.['2026-01-05']).toBeUndefined()
    expect(getState().states.ramp?.['2026-01-06']).toBeUndefined()
  })

  // Seed decisions belong to the seed grid. Hanging them off a grid the user
  // has already written would approve cells nobody bid for.
  it('does not seed states over a stored grid', () => {
    const backend = memoryBackend()
    backend.write('grid', JSON.stringify({ jaguar: { '2026-01-19': 'OL' } }))
    initStore(backend)
    expect(getState().states.jaguar?.['2026-01-19']).toBeUndefined()
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

  it('does not notify when there is nowhere further to go', () => {
    advanceStage(); advanceStage()
    const before = getVersion()
    advanceStage()
    expect(getVersion()).toBe(before)
  })

  it('persists the stage and reloads it', () => {
    const backend = memoryBackend()
    initStore(backend)
    advanceStage()
    initStore(backend)
    expect(getState().period.stage).toBe('closed')
  })
})

describe('the stored stage', () => {
  it.each([
    ['a stage nobody defined', 'reopened'],
    ['an empty string', ''],
    ['something that is not a stage at all', '{"stage":"open"}'],
  ])('falls back to the seeded stage when the backend holds %s', (_label, raw) => {
    const backend = memoryBackend()
    backend.write('stage', raw)
    initStore(backend)
    expect(getState().period.stage).toBe('open')
  })

  it('reloads every stage the cycle actually has', () => {
    for (const stage of ['draft', 'open', 'closed', 'published']) {
      const backend = memoryBackend()
      backend.write('stage', stage)
      initStore(backend)
      expect(getState().period.stage).toBe(stage)
    }
  })
})

describe('the stored bid record', () => {
  // Bids written by a build that predates sources are BARE STRINGS. Rejecting
  // them would degrade a squadron's real decisions to the seed to gain
  // nothing, so they are migrated instead. A string could only ever have
  // meant a bid placed here, so `source: 'bid'` is a fact, not a guess.
  it('migrates a bare string state written by an earlier build', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-19":"OL"}}')
    backend.write('states', '{"jaguar":{"2026-01-19":"refused"}}')
    initStore(backend)
    expect(getState().states.jaguar['2026-01-19']).toEqual({ state: 'refused', source: 'bid' })
  })

  it('round-trips a source and a shift through storage', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-19":"OL","2026-01-20":"LL"}}')
    backend.write('states', JSON.stringify({
      jaguar: {
        '2026-01-19': { state: 'approved', source: 'raptor' },
        '2026-01-20': { state: 'pending', source: 'bid', shiftedFrom: '2026-01-21' },
      },
    }))
    initStore(backend)
    expect(getState().states.jaguar['2026-01-19']).toEqual({ state: 'approved', source: 'raptor' })
    expect(getState().states.jaguar['2026-01-20']).toEqual({
      state: 'pending', source: 'bid', shiftedFrom: '2026-01-21',
    })
  })

  // Each shape names a cell the stored grid really holds and really is a bid,
  // so an accepted value would survive `reconcile` and land in `states` —
  // that is what makes these bite rather than pass vacuously through pruning.
  it.each([
    ['a source nobody defined', '{"jaguar":{"2026-01-19":{"state":"approved","source":"telepathy"}}}'],
    ['a record with no source at all', '{"jaguar":{"2026-01-19":{"state":"approved"}}}'],
    ['a state nobody defined', '{"jaguar":{"2026-01-19":{"state":"maybe","source":"bid"}}}'],
    ['a non-string shiftedFrom', '{"jaguar":{"2026-01-19":{"state":"pending","source":"bid","shiftedFrom":7}}}'],
    ['a leaf that is neither string nor record', '{"jaguar":{"2026-01-19":123}}'],
  ])('discards stored states holding %s, keeping the stored grid', (_label, raw) => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-19":"OL"}}')
    backend.write('states', raw)
    initStore(backend)
    expect(getState().grid.jaguar['2026-01-19']).toBe('OL')
    expect(getState().states.jaguar?.['2026-01-19']).toBeUndefined()
  })

  // Deciding is the second half of a shift. Losing the provenance at exactly
  // the moment management approves the date they moved it to would make the
  // trail useless.
  it('keeps the source and the shift when a decision is recorded', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-20":"LL"}}')
    backend.write('states', JSON.stringify({
      jaguar: { '2026-01-20': { state: 'pending', source: 'bid', shiftedFrom: '2026-01-21' } },
    }))
    initStore(backend)
    setBidState('jaguar', '2026-01-20', 'approved')
    expect(getState().states.jaguar['2026-01-20']).toEqual({
      state: 'approved', source: 'bid', shiftedFrom: '2026-01-21',
    })
  })

  // Replacing WHAT was asked for replaces the whole ask. The shift belonged
  // to the bid that has just been overwritten, so it must not survive onto
  // a different one.
  it('drops the shift record when the bid is changed to different leave', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-20":"LL"}}')
    backend.write('states', JSON.stringify({
      jaguar: { '2026-01-20': { state: 'pending', source: 'bid', shiftedFrom: '2026-01-21' } },
    }))
    initStore(backend)
    setCell('jaguar', '2026-01-20', 'OL')
    expect(getState().states.jaguar['2026-01-20']).toEqual({ state: 'pending', source: 'bid' })
  })
})
