import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceStage, getState, initStore, setRole } from '../state/store'
import { memoryBackend } from '../state/storage'
import { StageBar } from './Chrome'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

// Seed: ASICS has a pending half day of LL on 2026-01-23.
const PENDING = 'cell-asics-2026-01-23'

describe('deciding a bid', () => {
  it('offers nothing while bidding is still open', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
  })

  it('offers no bid picker once bidding has closed', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.queryByTestId('bid-LL')).toBeNull()
    expect(screen.queryByTestId('bid-clear')).toBeNull()
  })

  it('approves a pending bid once closed', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('approved')
  })

  // Acknowledging is deliberately NOT a decision: it records that management
  // has the bid in hand. The man stays out of the counts, because the counts
  // show the worst case and nothing has been granted or denied yet.
  it('acknowledges a pending bid without moving the counts', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    const before = screen.getByTestId('count-opsp-2026-01-23').textContent
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-ack'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('acknowledged')
    expect(screen.getByTestId('count-opsp-2026-01-23').textContent).toBe(before)
  })

  // An acknowledged bid is still awaiting an answer, so all three controls
  // have to remain on it — otherwise acknowledging would be a dead end.
  it('still offers every control on a bid already acknowledged', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-ack'))
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.getByTestId('decide-ack').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('approved')
  })

  it('refuses a pending bid, and the man returns to the counts', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    const before = screen.getByTestId('count-opsp-2026-01-23').textContent
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-refuse'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('refused')
    expect(screen.getByTestId('count-opsp-2026-01-23').textContent).not.toBe(before)
  })

  it('closes the sheet once a decision is made', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })

  // A decision can be changed while the period is still closed — the point
  // of showing the counts move is that management can try one and look.
  it('lets a decision be changed while the period is still closed', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-refuse'))
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('approved')
  })

  it('offers nothing on a cell nobody bid for', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    // PIPPER is on a course: not a bid, so there is nothing to decide.
    fireEvent.click(screen.getByTestId('cell-pipper-2026-01-12'))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
    // And an empty cell has nothing to decide either.
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
  })

  // Published is the end of the cycle: the squadron has been told the
  // outcome, so there is nothing left to decide. An admin can still correct
  // the sheet — they edit at every stage — which is why the picker opens
  // here and only the decision buttons are gone.
  it('offers no decision once the period is published, though an admin may still edit', () => {
    advanceStage()
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
    expect(screen.queryByTestId('decide-refuse')).toBeNull()
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })

  // The precedence that had to be got right: an admin at `closed` satisfies
  // both canEdit and canDecide. Deciding wins where there is a bid to decide,
  // and the picker still opens where there is not — so a closed sheet can
  // still have leave added to it without a second control.
  it('gives an admin the decision on a bid and the picker on an empty cell', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.getByTestId('decide-approve')).toBeTruthy()
    expect(screen.queryByTestId('bid-LL')).toBeNull()
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.getByTestId('bid-LL')).toBeTruthy()
    expect(screen.queryByTestId('decide-approve')).toBeNull()
  })
})

// The stage control lives in the chrome, not the matrix, so this block
// renders StageBar — rendering Matrix would find no button and the test
// would fail for the wrong reason.
describe('moving the period on', () => {
  it('walks the stage forward and stops at published', () => {
    render(<StageBar />)
    expect(getState().period.stage).toBe('open')
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(getState().period.stage).toBe('closed')
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(getState().period.stage).toBe('published')
    expect(screen.getByTestId('stage-advance').hasAttribute('disabled')).toBe(true)
  })

  it('names the stage it will move to, not the one it is in', () => {
    render(<StageBar />)
    expect(screen.getByTestId('stage-now').textContent).toBe('OPEN FOR BIDDING')
    expect(screen.getByTestId('stage-advance').textContent).toContain('BIDDING CLOSED')
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(screen.getByTestId('stage-now').textContent).toBe('BIDDING CLOSED')
    expect(screen.getByTestId('stage-advance').textContent).toContain('PUBLISHED')
  })
})

// The workflow the owner described: once bidding closes, the sheet is
// view-only for the squadron while the admin account keeps working.
describe('the edit lock', () => {
  it('lets a member edit while the war is open', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })

  it('locks a member out of everything once bidding closes', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
    // Not merely unable to bid — unable to decide either. A member watching
    // this screen sees the outcome, never the buttons.
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
    expect(screen.queryByTestId('decide-approve')).toBeNull()
  })

  it('keeps a member locked out at published', () => {
    advanceStage()
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })

  // The admin is the one who can still correct the sheet after closing it —
  // that is the whole reason the lock is role-shaped rather than a stage
  // flag that stops everybody.
  it('lets an admin still edit a cell after bidding has closed', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
  })

  it('follows the role switch without a reload', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
    act(() => setRole('admin'))
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })
})

describe('a cell Raptor owns', () => {
  // Seed: TATA's OIL on 9 Jan came in through Raptor's input tab.
  const RAPTOR = 'cell-tata-2026-01-09'

  it('opens a sheet that explains itself rather than offering a picker', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(RAPTOR))
    expect(screen.getByTestId('raptor-sheet')).toBeTruthy()
    expect(screen.queryByTestId('bid-LL')).toBeNull()
    expect(screen.queryByTestId('bid-clear')).toBeNull()
  })

  it('offers no decision to an admin once bidding has closed', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(RAPTOR))
    expect(screen.getByTestId('raptor-sheet')).toBeTruthy()
    expect(screen.queryByTestId('decide-approve')).toBeNull()
    expect(screen.queryByTestId('decide-refuse')).toBeNull()
  })

  // A member who cannot edit anything still deserves to be told why that
  // cell is green and why nothing here will change it.
  it('explains itself to a locked-out member too', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(RAPTOR))
    expect(screen.getByTestId('raptor-sheet')).toBeTruthy()
  })

  it('paints green, and marks where it came from', () => {
    render(<Matrix />)
    const chip = screen.getByTestId(RAPTOR).querySelector('.c')!
    expect(chip.className).toContain('appr')
    expect(chip.className).toContain('raptor')
  })
})

describe('shifting a bid', () => {
  beforeEach(() => {
    advanceStage()
    setRole('admin')
  })

  it('moves the bid and leaves it pending on the new date', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.change(screen.getByTestId('shift-date'), { target: { value: '2026-01-30' } })
    fireEvent.click(screen.getByTestId('decide-shift'))
    expect(getState().grid.asics?.['2026-01-23']).toBeUndefined()
    expect(getState().grid.asics['2026-01-30']).toBe('*LL')
    expect(getState().states.asics['2026-01-30']).toEqual({
      state: 'pending', source: 'bid', shiftedFrom: '2026-01-23',
    })
  })

  it('marks the moved cell so the trail is visible on the grid', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.change(screen.getByTestId('shift-date'), { target: { value: '2026-01-30' } })
    fireEvent.click(screen.getByTestId('decide-shift'))
    expect(screen.getByTestId('cell-asics-2026-01-30').querySelector('.c')!.className).toContain('moved')
  })

  it('says why, rather than doing nothing, when the destination is taken', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    // ASICS already has LL on 2026-01-08.
    fireEvent.change(screen.getByTestId('shift-date'), { target: { value: '2026-01-08' } })
    fireEvent.click(screen.getByTestId('decide-shift'))
    expect(screen.getByTestId('shift-problem').textContent).toContain('already has something booked')
    expect(getState().grid.asics['2026-01-23']).toBe('*LL')
  })

  it('cannot be moved until a date is chosen', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.getByTestId('decide-shift').hasAttribute('disabled')).toBe(true)
  })

  it('bounds the move to the period it belongs to', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    const input = screen.getByTestId('shift-date')
    expect(input.getAttribute('min')).toBe('2026-01-01')
    expect(input.getAttribute('max')).toBe('2026-12-31')
  })

  // The second half of the move. Management approves the date they moved it
  // to, and the trail has to survive that.
  it('keeps the trail when the moved bid is then approved', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.change(screen.getByTestId('shift-date'), { target: { value: '2026-01-30' } })
    fireEvent.click(screen.getByTestId('decide-shift'))
    fireEvent.click(screen.getByTestId('cell-asics-2026-01-30'))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(getState().states.asics['2026-01-30']).toEqual({
      state: 'approved', source: 'bid', shiftedFrom: '2026-01-23',
    })
  })
})

// Owner, 10 Aug 26: "as an admin I can open bidding again after closing it".
describe('reopening the period from the strip', () => {
  it('offers a member no way back', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(getState().period.stage).toBe('closed')
    expect(screen.queryByTestId('stage-back')).toBeNull()
  })

  it('gives an admin a control back to bidding', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('stage-advance'))
    act(() => setRole('admin'))
    fireEvent.click(screen.getByTestId('stage-back'))
    expect(getState().period.stage).toBe('open')
  })

  // It names where it goes, exactly as the forward control does — the pair
  // has to read as one cycle rather than as two unrelated buttons.
  it('names the stage it returns to', () => {
    act(() => setRole('admin'))
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(screen.getByTestId('stage-back').textContent).toContain('OPEN FOR BIDDING')
    fireEvent.click(screen.getByTestId('stage-advance'))
    expect(screen.getByTestId('stage-back').textContent).toContain('BIDDING CLOSED')
  })

  it('offers nothing at draft, where there is nowhere back to', () => {
    act(() => setRole('admin'))
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('stage-back'))
    expect(getState().period.stage).toBe('draft')
    expect(screen.queryByTestId('stage-back')).toBeNull()
  })

  // The point of the whole change: after reopening, the squadron can bid
  // again. Asserted through the matrix rather than the stage field, because
  // the stage is only interesting for what it lets people do.
  it('lets a member bid again once an admin has reopened', () => {
    act(() => setRole('admin'))
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('stage-advance'))
    render(<Matrix />)
    act(() => setRole('member'))
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()

    act(() => setRole('admin'))
    fireEvent.click(screen.getByTestId('stage-back'))
    act(() => setRole('member'))
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })
})
