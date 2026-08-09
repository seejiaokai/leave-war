import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceStage, getState, initStore } from '../state/store'
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
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('approved')
  })

  it('refuses a pending bid, and the man returns to the counts', () => {
    advanceStage()
    render(<Matrix />)
    const before = screen.getByTestId('count-opsp-2026-01-23').textContent
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-refuse'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('refused')
    expect(screen.getByTestId('count-opsp-2026-01-23').textContent).not.toBe(before)
  })

  it('closes the sheet once a decision is made', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })

  // A decision can be changed while the period is still closed — the point
  // of showing the counts move is that management can try one and look.
  it('lets a decision be changed while the period is still closed', () => {
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-refuse'))
    fireEvent.click(screen.getByTestId(PENDING))
    fireEvent.click(screen.getByTestId('decide-approve'))
    expect(getState().states.asics['2026-01-23']?.state).toBe('approved')
  })

  it('offers nothing on a cell nobody bid for', () => {
    advanceStage()
    render(<Matrix />)
    // PIPPER is on a course: not a bid, so there is nothing to decide.
    fireEvent.click(screen.getByTestId('cell-pipper-2026-01-12'))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
    // And an empty cell has nothing to decide either.
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
  })

  it('offers nothing once the period is published', () => {
    advanceStage()
    advanceStage()
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(PENDING))
    expect(screen.queryByTestId('decide-approve')).toBeNull()
    expect(screen.queryByTestId('bid-picker')).toBeNull()
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
