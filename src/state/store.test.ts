import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  advanceStage,
  getState,
  getVersion,
  ingestFromRaptor,
  initStore,
  setBidState,
  setCell,
  createWar,
  selectWar,
  setRole,
  setBidWindow,
  clearBidWindow,
  shiftBid,
  subscribe,
} from './store'
import { makeWar } from '../engine'
import { localBackend, memoryBackend } from './storage'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('store', () => {
  it('boots with the seeded roster and period', () => {
    expect(getState().people.length).toBeGreaterThan(0)
    expect(getState().period.days).toHaveLength(365)
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

  // Stage now lives INSIDE its war, because each war has its own. The bare
  // `stage` key survives only as part of the single-war migration below,
  // which is why these cases now write a grid alongside it.
  it('reloads every stage the cycle has, through the old single-war shape', () => {
    for (const stage of ['draft', 'open', 'closed', 'published']) {
      const backend = memoryBackend()
      backend.write('grid', '{"jaguar":{"2026-01-19":"OL"}}')
      backend.write('stage', stage)
      initStore(backend)
      expect(getState().period.stage).toBe(stage)
    }
  })

  it('reloads each war with its own stage, independently', () => {
    const backend = memoryBackend()
    initStore(backend)
    advanceStage() // the open war -> closed
    const other = getState().wars.find(w => w.period.id !== getState().currentId)!
    expect(other.period.stage).toBe('draft')
    initStore(backend)
    expect(getState().period.stage).toBe('closed')
    expect(getState().wars.find(w => w.period.id !== getState().currentId)!.period.stage).toBe('draft')
  })
})

describe('upgrading a browser that predates more than one war', () => {
  // Those browsers hold `grid`, `states` and `stage` and no `wars`, and all
  // of it belonged to the only period that existed. Rebuilding it as a
  // single war rather than discarding follows the same rule as the
  // bid-record migration: a squadron's real leave is not worth throwing away
  // to save a branch.
  it('rebuilds one war from the old keys, keeping the leave and the decisions', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-19":"OL"}}')
    backend.write('states', '{"jaguar":{"2026-01-19":{"state":"refused","source":"bid"}}}')
    backend.write('stage', 'closed')
    initStore(backend)

    expect(getState().wars).toHaveLength(1)
    expect(getState().grid.jaguar['2026-01-19']).toBe('OL')
    expect(getState().states.jaguar['2026-01-19'].state).toBe('refused')
    expect(getState().period.stage).toBe('closed')
  })

  it('still seeds both wars on a genuinely fresh boot', () => {
    initStore(memoryBackend())
    expect(getState().wars.length).toBeGreaterThan(1)
  })

  // Once migrated, the next save writes the new shape, so the old keys stop
  // being consulted. Without this the migration would run on every boot and
  // quietly discard whatever had happened since.
  it('writes the new shape on the next save, so it migrates once', () => {
    const backend = memoryBackend()
    backend.write('grid', '{"jaguar":{"2026-01-19":"OL"}}')
    initStore(backend)
    setCell('jaguar', '2026-01-20', 'LL')
    initStore(backend)
    expect(getState().grid.jaguar['2026-01-20']).toBe('LL')
    expect(getState().wars).toHaveLength(1)
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

describe('the role', () => {
  it('opens as a member, not with the locks already off', () => {
    expect(getState().role).toBe('member')
  })

  it('switches, persists and reloads', () => {
    const backend = memoryBackend()
    initStore(backend)
    setRole('admin')
    expect(getState().role).toBe('admin')
    initStore(backend)
    expect(getState().role).toBe('admin')
  })

  it('falls back to member when the stored role is not one', () => {
    const backend = memoryBackend()
    backend.write('role', 'superuser')
    initStore(backend)
    expect(getState().role).toBe('member')
  })

  it('does not notify when set to the role it already is', () => {
    setRole('admin')
    const before = getVersion()
    setRole('admin')
    expect(getVersion()).toBe(before)
  })
})

describe('leave that came in through Raptor', () => {
  // Entering leave in Raptor's input tab means the person asked verbally and
  // was told yes. The approval has already happened; Leave War is being told
  // about it, not being asked to decide it.
  it('lands already approved, and marked as Raptor\'s', () => {
    expect(ingestFromRaptor('dusk', '2026-02-11', 'LL')).toBe('written')
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().states.dusk['2026-02-11']).toEqual({ state: 'approved', source: 'raptor' })
  })

  it('takes a half day in the squadron\'s own notation', () => {
    expect(ingestFromRaptor('dusk', '2026-02-11', '*LL')).toBe('written')
    expect(getState().grid.dusk['2026-02-11']).toBe('*LL')
  })

  // The spec's rule, unchanged: the system never overwrites a bid. It raises
  // the clash and a human decides.
  it('never overwrites a different bid — it reports a clash instead', () => {
    setCell('dusk', '2026-02-11', 'LL')
    expect(ingestFromRaptor('dusk', '2026-02-11', 'OL')).toBe('clash')
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().states.dusk['2026-02-11']).toEqual({ state: 'pending', source: 'bid' })
  })

  // The same code is not a clash. That is Raptor confirming what was already
  // asked for, so the cell is upgraded in place rather than left pending
  // forever waiting on a decision that has already been made.
  it('confirms a matching bid in place, approving it', () => {
    setCell('dusk', '2026-02-11', 'LL')
    expect(ingestFromRaptor('dusk', '2026-02-11', 'LL')).toBe('confirmed')
    expect(getState().states.dusk['2026-02-11']).toEqual({ state: 'approved', source: 'raptor' })
  })

  it('ignores a code nobody bids for, and an empty one', () => {
    expect(ingestFromRaptor('dusk', '2026-02-11', 'CSE')).toBe('ignored')
    expect(ingestFromRaptor('dusk', '2026-02-11', '')).toBe('ignored')
    expect(ingestFromRaptor('dusk', '2026-02-11', 'ZZZ')).toBe('ignored')
    expect(getState().grid.dusk?.['2026-02-11']).toBeUndefined()
  })

  it('re-ingesting a cell Raptor already owns just updates it', () => {
    ingestFromRaptor('dusk', '2026-02-11', 'LL')
    expect(ingestFromRaptor('dusk', '2026-02-11', 'OL')).toBe('written')
    expect(getState().grid.dusk['2026-02-11']).toBe('OL')
    expect(getState().states.dusk['2026-02-11']).toEqual({ state: 'approved', source: 'raptor' })
  })
})

describe('a cell Raptor owns', () => {
  beforeEach(() => {
    ingestFromRaptor('dusk', '2026-02-11', 'LL')
  })

  // Raptor owns what Raptor last wrote. It is changed in Raptor's input tab
  // and syncs back here; changing it here would leave the two systems
  // disagreeing, which is the single failure this model exists to prevent.
  it('cannot be edited from Leave War', () => {
    setCell('dusk', '2026-02-11', 'OL')
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().states.dusk['2026-02-11'].source).toBe('raptor')
  })

  it('cannot be cleared from Leave War', () => {
    setCell('dusk', '2026-02-11', '')
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
  })

  // There is nothing here to decide: the approval already happened, verbally,
  // before Leave War ever saw the cell.
  it('cannot be approved or refused from Leave War', () => {
    setBidState('dusk', '2026-02-11', 'refused')
    expect(getState().states.dusk['2026-02-11'].state).toBe('approved')
  })

  it('does not notify when a refused write is ignored', () => {
    const before = getVersion()
    setCell('dusk', '2026-02-11', 'OL')
    setBidState('dusk', '2026-02-11', 'refused')
    expect(getVersion()).toBe(before)
  })
})

describe('shifting a bid', () => {
  // Management moves leave to a different date instead of refusing it — what
  // they actually do when a week goes red and refusing outright is too blunt.
  it('moves the code to the new date and empties the old one', () => {
    setCell('dusk', '2026-02-11', 'LL')
    expect(shiftBid('dusk', '2026-02-11', '2026-02-18')).toBe('shifted')
    expect(getState().grid.dusk?.['2026-02-11']).toBeUndefined()
    expect(getState().grid.dusk['2026-02-18']).toBe('LL')
  })

  // A shift is a PROPOSAL with a paper trail, not a silent re-approval.
  // Management still has to approve the date they moved it to.
  it('lands pending, recording the date it came from', () => {
    setCell('dusk', '2026-02-11', 'LL')
    setBidState('dusk', '2026-02-11', 'approved')
    shiftBid('dusk', '2026-02-11', '2026-02-18')
    expect(getState().states.dusk['2026-02-18']).toEqual({
      state: 'pending', source: 'bid', shiftedFrom: '2026-02-11',
    })
    expect(getState().states.dusk?.['2026-02-11']).toBeUndefined()
  })

  it('keeps the portion — a shifted morning is still a morning', () => {
    setCell('dusk', '2026-02-11', '*LL')
    shiftBid('dusk', '2026-02-11', '2026-02-18')
    expect(getState().grid.dusk['2026-02-18']).toBe('*LL')
  })

  it('approving afterwards keeps the trail', () => {
    setCell('dusk', '2026-02-11', 'LL')
    shiftBid('dusk', '2026-02-11', '2026-02-18')
    setBidState('dusk', '2026-02-18', 'approved')
    expect(getState().states.dusk['2026-02-18']).toEqual({
      state: 'approved', source: 'bid', shiftedFrom: '2026-02-11',
    })
  })

  // Never overwrite. Moving one man's leave onto a day he already has
  // something booked would destroy the second booking to save the first.
  it('refuses a destination that already holds a code', () => {
    setCell('dusk', '2026-02-11', 'LL')
    setCell('dusk', '2026-02-18', 'OL')
    expect(shiftBid('dusk', '2026-02-11', '2026-02-18')).toBe('occupied')
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().grid.dusk['2026-02-18']).toBe('OL')
  })

  it('refuses to move a cell Raptor owns', () => {
    ingestFromRaptor('dusk', '2026-02-11', 'LL')
    expect(shiftBid('dusk', '2026-02-11', '2026-02-18')).toBe('raptor')
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().grid.dusk?.['2026-02-18']).toBeUndefined()
  })

  it('refuses to move a cell that holds no bid', () => {
    expect(shiftBid('dusk', '2026-02-11', '2026-02-18')).toBe('nothing')
    setCell('dusk', '2026-02-11', 'CSE')
    expect(shiftBid('dusk', '2026-02-11', '2026-02-18')).toBe('nothing')
  })

  it('refuses to move a bid onto the date it is already on', () => {
    setCell('dusk', '2026-02-11', 'LL')
    expect(shiftBid('dusk', '2026-02-11', '2026-02-11')).toBe('occupied')
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
  })

  it('does not notify when a shift is refused', () => {
    setCell('dusk', '2026-02-11', 'LL')
    setCell('dusk', '2026-02-18', 'OL')
    const before = getVersion()
    shiftBid('dusk', '2026-02-11', '2026-02-18')
    expect(getVersion()).toBe(before)
  })

  it('persists across a reload', () => {
    const backend = memoryBackend()
    initStore(backend)
    setCell('dusk', '2026-02-11', 'LL')
    shiftBid('dusk', '2026-02-11', '2026-02-18')
    initStore(backend)
    expect(getState().states.dusk['2026-02-18'].shiftedFrom).toBe('2026-02-11')
  })
})

describe('balances in the store', () => {
  it('boots with an opening figure for everyone and a ledger', () => {
    expect(Object.keys(getState().openings).length).toBe(getState().people.length)
    expect(getState().ledger.length).toBeGreaterThan(0)
  })

  it('persists and reloads both', () => {
    const backend = memoryBackend()
    initStore(backend)
    const openings = getState().openings
    const ledger = getState().ledger
    initStore(backend)
    expect(getState().openings).toEqual(openings)
    expect(getState().ledger).toEqual(ledger)
  })

  // Each shape is asserted against a seed-only value so a fallback to `{}`
  // or `[]` would not pass by accident.
  it.each([
    ['not json', 'not json'],
    ['an array', '[]'],
    ['a counter nobody defined', '{"ramp":{"holiday":5}}'],
    ['a figure that is not a number', '{"ramp":{"annual":"lots"}}'],
    // NaN is the dangerous one: it propagates silently through every sum it
    // touches, turning a whole column of balances into "NaN" with nothing to
    // say why. JSON has no NaN literal, so it arrives as null.
    ['a non-finite figure', '{"ramp":{"annual":null}}'],
  ])('falls back to the seeded openings when the backend holds %s', (_label, raw) => {
    const backend = memoryBackend()
    backend.write('openings', raw)
    initStore(backend)
    expect(getState().openings.ramp.annual).toBe(12)
  })

  it.each([
    ['not json', 'not json'],
    ['an object rather than a list', '{}'],
    ['an entry with no reason', '[{"id":"x","personId":"ramp","counter":"annual","amount":1,"date":"2026-01-01","approvedBy":"SQNCDR"}]'],
    ['an entry with no approver', '[{"id":"x","personId":"ramp","counter":"annual","amount":1,"date":"2026-01-01","reason":"top-up"}]'],
    ['an entry against an unknown counter', '[{"id":"x","personId":"ramp","counter":"holiday","amount":1,"date":"2026-01-01","reason":"r","approvedBy":"a"}]'],
  ])('falls back to the seeded ledger when the backend holds %s', (_label, raw) => {
    const backend = memoryBackend()
    backend.write('ledger', raw)
    initStore(backend)
    expect(getState().ledger.some(e => e.id === 'l1')).toBe(true)
  })

  it('keeps a well-formed stored ledger', () => {
    const backend = memoryBackend()
    backend.write('ledger', '[{"id":"x","personId":"ramp","counter":"oil","amount":2.5,"date":"2026-01-01","reason":"CNY","approvedBy":"SQNCDR"}]')
    initStore(backend)
    expect(getState().ledger).toEqual([
      { id: 'x', personId: 'ramp', counter: 'oil', amount: 2.5, date: '2026-01-01', reason: 'CNY', approvedBy: 'SQNCDR' },
    ])
  })
})

describe('more than one leave war', () => {
  it('boots with the first war on screen', () => {
    expect(getState().wars.length).toBeGreaterThan(1)
    expect(getState().currentId).toBe(getState().wars[0].period.id)
    expect(getState().period.name).toBe('JAN - DEC 26')
  })

  it('switches to another war, and the grid on screen switches with it', () => {
    const other = getState().wars[1].period.id
    selectWar(other)
    expect(getState().currentId).toBe(other)
    expect(getState().period.name).toBe('JAN - DEC 27')
    // The Jan–Mar leave is no longer what `grid` answers with.
    expect(getState().grid.ramp?.['2026-01-01']).toBeUndefined()
  })

  it('ignores a war that does not exist rather than blanking the screen', () => {
    const before = getState().currentId
    selectWar('no-such-war')
    expect(getState().currentId).toBe(before)
  })

  it('does not notify when asked to select the war already on screen', () => {
    const before = getVersion()
    selectWar(getState().currentId)
    expect(getVersion()).toBe(before)
  })

  it('remembers which war was on screen across a reload', () => {
    const backend = memoryBackend()
    initStore(backend)
    selectWar(getState().wars[1].period.id)
    const chosen = getState().currentId
    initStore(backend)
    expect(getState().currentId).toBe(chosen)
  })

  // Writes land in the war on screen and nowhere else. A cell written while
  // looking at Apr–Jun must not appear in Jan–Mar.
  // Admin, and that is not incidental. This test used to pass as a MEMBER
  // writing into a DRAFT war, because `setCell` checked neither stage nor
  // role — the edit lock lived only in the grid's click handler, so anything
  // calling the store directly walked straight past it. Adding the bidding
  // window put all three checks in the store and this test went red, which is
  // the tightening working rather than the test being wrong. Its own subject
  // — that a write lands in the war on screen — is unchanged.
  it('writes into the war on screen, leaving the others untouched', () => {
    setRole('admin')
    const [q1, q2] = getState().wars.map(w => w.period.id)
    selectWar(q2)
    setCell('dusk', '2027-04-20', 'LL')
    expect(getState().grid.dusk['2027-04-20']).toBe('LL')
    selectWar(q1)
    expect(getState().grid.dusk?.['2027-04-20']).toBeUndefined()
  })

  it('advances the stage of the war on screen only', () => {
    const [q1, q2] = getState().wars.map(w => w.period.id)
    selectWar(q2)
    advanceStage() // draft -> open
    expect(getState().period.stage).toBe('open')
    selectWar(q1)
    expect(getState().period.stage).toBe('open') // its own, unchanged
    advanceStage()
    expect(getState().period.stage).toBe('closed')
    selectWar(q2)
    expect(getState().period.stage).toBe('open')
  })
})

describe('creating a leave war', () => {
  beforeEach(() => {
    setRole('admin')
  })

  it('creates one over any span, down to a single month', () => {
    expect(createWar('JUL 28', '2028-07-01', '2028-07-31')).toBe('created')
    const made = getState().wars.find(w => w.period.name === 'JUL 28')!
    expect(made.period.days).toHaveLength(31)
    expect(made.grid).toEqual({})
  })

  // A new war starts in draft and is NOT switched to. Creating next
  // quarter's war should not yank the admin off the one they are working in.
  it('starts it in draft and leaves the current war on screen', () => {
    const before = getState().currentId
    createWar('JUL 28', '2028-07-01', '2028-07-31')
    expect(getState().currentId).toBe(before)
    expect(getState().wars.find(w => w.period.name === 'JUL 28')!.period.stage).toBe('draft')
  })

  // A date belongs to at most one war, or a person could hold leave on it
  // twice over and the manning counts would count him away twice.
  it('refuses a span that overlaps a war that already exists', () => {
    const before = getState().wars.length
    expect(createWar('CLASH', '2026-03-15', '2026-05-15')).toBe('overlap')
    expect(getState().wars).toHaveLength(before)
  })

  it('allows a span that begins the day after another ends', () => {
    expect(createWar('JUL 28', '2028-07-01', '2028-07-31')).toBe('created')
  })

  it('refuses a range that ends before it starts', () => {
    expect(createWar('BACKWARDS', '2028-07-31', '2028-07-01')).toBe('backwards')
    expect(getState().wars.every(w => w.period.name !== 'BACKWARDS')).toBe(true)
  })

  it('refuses a war with no name', () => {
    expect(createWar('   ', '2028-07-01', '2028-07-31')).toBe('unnamed')
  })

  // Creating a leave war is an admin act. A member has no business making
  // one, and the store says so rather than relying on the button being
  // hidden — the switch that hides it is unguarded.
  it('refuses a member, not just hides the button', () => {
    setRole('member')
    expect(createWar('JUL 28', '2028-07-01', '2028-07-31')).toBe('forbidden')
    expect(getState().wars.every(w => w.period.name !== 'JUL 28')).toBe(true)
  })

  it('gives every war a distinct id, even for two wars named alike', () => {
    createWar('JUL 28', '2028-07-01', '2028-07-31')
    createWar('JUL 28', '2028-08-01', '2028-08-31')
    const ids = getState().wars.map(w => w.period.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('persists a new war across a reload', () => {
    const backend = memoryBackend()
    initStore(backend)
    setRole('admin')
    createWar('JUL 28', '2028-07-01', '2028-07-31')
    initStore(backend)
    expect(getState().wars.some(w => w.period.name === 'JUL 28')).toBe(true)
  })

  it('does not notify when a creation is refused', () => {
    const before = getVersion()
    createWar('CLASH', '2026-03-15', '2026-05-15')
    expect(getVersion()).toBe(before)
  })
})

describe('reading stored wars', () => {
  const stored = (...wars: unknown[]) => JSON.stringify(wars)
  const war = (id: string, start: string, end: string) => makeWar(id, id.toUpperCase(), start, end)

  it('keeps a well-formed pair', () => {
    const backend = memoryBackend()
    backend.write('wars', stored(war('a', '2026-01-01', '2026-03-31'), war('b', '2026-04-01', '2026-06-30')))
    initStore(backend)
    expect(getState().wars.map(w => w.period.id)).toEqual(['a', 'b'])
  })

  // The one shape nothing downstream can resolve: two wars claiming the same
  // day. `warHolding` would answer with whichever came first, and a person
  // could hold leave on that date twice over. Reject the blob entire rather
  // than pick a winner.
  it('rejects two wars that share a day, falling back to the seed', () => {
    const backend = memoryBackend()
    backend.write('wars', stored(war('a', '2026-01-01', '2026-03-31'), war('b', '2026-03-31', '2026-06-30')))
    initStore(backend)
    expect(getState().wars.map(w => w.period.id)).toEqual(['y2026', 'y2027'])
  })

  it('rejects two wars sharing an id', () => {
    const backend = memoryBackend()
    backend.write('wars', stored(war('a', '2026-01-01', '2026-03-31'), war('a', '2026-04-01', '2026-06-30')))
    initStore(backend)
    expect(getState().wars.map(w => w.period.id)).toEqual(['y2026', 'y2027'])
  })

  it.each([
    ['an empty list', '[]'],
    ['not a list', '{}'],
    ['a war that is not an object', '["nope"]'],
  ])('rejects %s, falling back to the seed', (_label, raw) => {
    const backend = memoryBackend()
    backend.write('wars', raw)
    initStore(backend)
    expect(getState().wars).toHaveLength(2)
    expect(getState().period.name).toBe('JAN - DEC 26')
  })

  it('rejects a war whose stage is not one of the cycle', () => {
    const backend = memoryBackend()
    const w = war('a', '2026-01-01', '2026-03-31') as unknown as { period: Record<string, unknown> }
    w.period.stage = 'reopened'
    backend.write('wars', stored(w))
    initStore(backend)
    expect(getState().period.name).toBe('JAN - DEC 26')
  })

  it('rejects a war whose range runs backwards', () => {
    const backend = memoryBackend()
    const w = war('a', '2026-01-01', '2026-03-31') as unknown as { period: Record<string, unknown> }
    w.period.end = '2025-12-01'
    backend.write('wars', stored(w))
    initStore(backend)
    expect(getState().period.name).toBe('JAN - DEC 26')
  })

  // A day carries events, a blocked flag and its reason — facts the date
  // range cannot regenerate. They are stored in full and must survive, or a
  // scheduler loses their exercise week on every reload.
  it('keeps each day’s events, blocked flag and reason', () => {
    const backend = memoryBackend()
    initStore(backend)
    // A WRITE is what saves. Without one, `initStore` twice over just seeds
    // twice and never round-trips through storage at all — which is how the
    // first draft of this test passed against a loader that discarded every
    // day.
    setCell('ramp', '2026-01-20', 'LL')
    initStore(backend)
    expect(getState().grid.ramp['2026-01-20']).toBe('LL')
    const blocked = getState().period.days.find(d => d.date === '2026-03-10')!
    expect(blocked.blocked).toBe(true)
    expect(blocked.blockedReason).toBe('Exercise week')
    expect(getState().period.days.find(d => d.date === '2026-01-01')!.ph).toBe(true)
  })
})

describe('the bidding window', () => {
  beforeEach(() => {
    initStore(memoryBackend())
  })

  // The seed opens the year on its first quarter, so the window is real from
  // the first screen rather than a feature nobody can see until they set one.
  it('seeds the current war with bidding open on the first quarter', () => {
    expect(getState().period.bidFrom).toBe('2026-01-01')
    expect(getState().period.bidTo).toBe('2026-03-31')
  })

  it('lets a member write inside the window', () => {
    setCell('ramp', '2026-02-11', 'LL')
    expect(getState().grid.ramp['2026-02-11']).toBe('LL')
  })

  // The store is what makes the lock true. The grid hides an unopenable cell,
  // but anything calling the store directly — a keyboard path, a future sync,
  // a test — has to hit the same wall.
  it('refuses a member writing outside the window, silently and without a version bump', () => {
    const before = getVersion()
    setCell('ramp', '2026-08-11', 'LL')
    expect(getState().grid.ramp?.['2026-08-11']).toBeUndefined()
    expect(getVersion()).toBe(before)
  })

  it('lets an admin write outside the window', () => {
    setRole('admin')
    setCell('ramp', '2026-08-11', 'LL')
    expect(getState().grid.ramp['2026-08-11']).toBe('LL')
  })

  it('moves the window, and the member follows it', () => {
    setRole('admin')
    expect(setBidWindow('2026-07-01', '2026-09-30')).toBe('set')
    setRole('member')
    setCell('ramp', '2026-08-11', 'LL')
    expect(getState().grid.ramp['2026-08-11']).toBe('LL')
    setCell('ramp', '2026-02-11', 'OL')
    expect(getState().grid.ramp?.['2026-02-11']).toBeUndefined()
  })

  it('refuses a window a member tries to set', () => {
    expect(setBidWindow('2026-07-01', '2026-09-30')).toBe('forbidden')
    expect(getState().period.bidFrom).toBe('2026-01-01')
  })

  it('refuses a window that leaves the war, and one that runs backwards', () => {
    setRole('admin')
    expect(setBidWindow('2025-12-01', '2026-03-31')).toBe('outside')
    expect(setBidWindow('2026-11-01', '2027-02-01')).toBe('outside')
    expect(setBidWindow('2026-09-30', '2026-07-01')).toBe('backwards')
    // Refused means UNCHANGED, not partly applied.
    expect(getState().period.bidFrom).toBe('2026-01-01')
    expect(getState().period.bidTo).toBe('2026-03-31')
  })

  it('clears the window, opening the whole war again', () => {
    setRole('admin')
    expect(clearBidWindow()).toBe('set')
    setRole('member')
    setCell('ramp', '2026-08-11', 'LL')
    expect(getState().grid.ramp['2026-08-11']).toBe('LL')
  })

  it('belongs to the war, not to the app', () => {
    setRole('admin')
    setBidWindow('2026-07-01', '2026-09-30')
    const [, y27] = getState().wars.map(w => w.period.id)
    selectWar(y27)
    expect(getState().period.bidFrom).toBeNull()
    expect(getState().wars[0].period.bidFrom).toBe('2026-07-01')
  })

  it('survives a reload', () => {
    const backend = memoryBackend()
    initStore(backend)
    setRole('admin')
    setBidWindow('2026-07-01', '2026-09-30')
    initStore(backend)
    expect(getState().period.bidFrom).toBe('2026-07-01')
    expect(getState().period.bidTo).toBe('2026-09-30')
  })

  // A war written before the window existed has neither key. Reading it as
  // "the whole period is open" is what that war actually did, and rejecting
  // it would throw away a squadron's grid over a field that did not exist
  // when it was saved. Everything else in this loader degrades to the seed;
  // this one field is deliberately lenient, so it gets its own test.
  it('reads a stored war with no window at all as fully open', () => {
    const backend = memoryBackend()
    const war = makeWar('old', 'OLD', '2026-01-01', '2026-12-31')
    const { bidFrom: _f, bidTo: _t, ...periodWithoutWindow } = war.period
    backend.write('wars', JSON.stringify([{ ...war, period: { ...periodWithoutWindow, stage: 'open' } }]))
    backend.write('current', JSON.stringify('old'))
    initStore(backend)

    expect(getState().period.id).toBe('old')
    expect(getState().period.bidFrom).toBeNull()
    setCell('ramp', '2026-08-11', 'LL')
    expect(getState().grid.ramp['2026-08-11']).toBe('LL')
  })

  // Present but nonsense is corruption, not an older shape, and falls back to
  // the seed like every other malformed field here.
  it('rejects a stored window that leaves its own war', () => {
    const backend = memoryBackend()
    const war = makeWar('bad', 'BAD', '2026-01-01', '2026-12-31')
    war.period.bidFrom = '2025-01-01'
    backend.write('wars', JSON.stringify([war]))
    backend.write('current', JSON.stringify('bad'))
    initStore(backend)
    expect(getState().wars.map(w => w.period.id)).toEqual(['y2026', 'y2027'])
  })
})
