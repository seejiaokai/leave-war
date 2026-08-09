import { describe, expect, it } from 'vitest'
import type { Grid } from './availability'
import type { States } from './bids'
import { outboundToRaptor } from './raptor'

const grid: Grid = {
  ramp: { '2026-01-05': 'LL', '2026-01-06': 'OL', '2026-01-07': '*LL' },
  tata: { '2026-01-05': 'OIL', '2026-01-08': 'CSE', '2026-01-09': 'FS' },
  dusk: { '2026-01-05': 'LL' },
}

const states: States = {
  ramp: {
    '2026-01-05': { state: 'approved', source: 'bid' },
    '2026-01-06': { state: 'refused', source: 'bid' },
    '2026-01-07': { state: 'pending', source: 'bid' },
  },
  tata: { '2026-01-05': { state: 'approved', source: 'raptor' } },
  // dusk's LL carries no record at all — a bid nobody has decided.
}

describe('outboundToRaptor', () => {
  // Only green leave crosses. That is the owner's rule: once it is approved,
  // Raptor takes it as a personal input on the schedule.
  it('sends approved leave the squadron bid for', () => {
    expect(outboundToRaptor(grid, states)).toEqual([
      { personId: 'ramp', date: '2026-01-05', code: 'LL' },
    ])
  })

  it('sends nothing that is still pending, refused or undecided', () => {
    const dates = outboundToRaptor(grid, states).map(o => `${o.personId} ${o.date}`)
    expect(dates).not.toContain('ramp 2026-01-06') // refused
    expect(dates).not.toContain('ramp 2026-01-07') // pending
    expect(dates).not.toContain('dusk 2026-01-05') // never decided
  })

  // A cell Raptor already owns came FROM Raptor. Sending it back would be
  // this app telling Raptor something Raptor told it, which is how a sync
  // loop starts.
  it('never sends back a cell Raptor already owns', () => {
    expect(outboundToRaptor(grid, states).map(o => o.personId)).not.toContain('tata')
  })

  it('sends nothing for codes nobody bids for, whatever state is attached', () => {
    const odd: States = { tata: { '2026-01-08': { state: 'approved', source: 'bid' } } }
    expect(outboundToRaptor(grid, odd)).toEqual([])
  })

  // The portion travels with the code. Raptor needs the portion field before
  // it can receive `*LL` at all — that is the contract document's job — but
  // what this app sends is the notation it stores, unaltered.
  it('carries the portion in the squadron’s own notation', () => {
    const half: States = { ramp: { '2026-01-07': { state: 'approved', source: 'bid' } } }
    expect(outboundToRaptor(grid, half)).toEqual([
      { personId: 'ramp', date: '2026-01-07', code: '*LL' },
    ])
  })

  // A shifted bid that was then approved is ordinary approved leave as far
  // as Raptor is concerned: the date it goes out on is the date it ended up.
  it('sends a shifted bid on the date it ended up', () => {
    const shifted: States = {
      ramp: { '2026-01-05': { state: 'approved', source: 'bid', shiftedFrom: '2026-01-02' } },
    }
    expect(outboundToRaptor(grid, shifted)).toEqual([
      { personId: 'ramp', date: '2026-01-05', code: 'LL' },
    ])
  })

  it('is stable in person then date order, so two runs compare equal', () => {
    const many: States = {
      tata: { '2026-01-05': { state: 'approved', source: 'bid' } },
      ramp: {
        '2026-01-06': { state: 'approved', source: 'bid' },
        '2026-01-05': { state: 'approved', source: 'bid' },
      },
    }
    expect(outboundToRaptor(grid, many).map(o => `${o.personId} ${o.date}`)).toEqual([
      'ramp 2026-01-05',
      'ramp 2026-01-06',
      'tata 2026-01-05',
    ])
  })

  it('sends nothing at all from an empty leave war', () => {
    expect(outboundToRaptor({}, {})).toEqual([])
  })
})
