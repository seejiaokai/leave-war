import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getState, initStore, setBidState } from '../state/store'
import { memoryBackend } from '../state/storage'
import { StageBar } from './Chrome'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('the stage strip', () => {
  it('names the stage the period is in', () => {
    render(<StageBar />)
    expect(getState().period.stage).toBe('open')
    expect(screen.getByTestId('stage-now').textContent).toBe('OPEN FOR BIDDING')
  })

  // The under-manned tally is the one number in the chrome that depends on
  // the bid states, and it is counted from its own evaluatePeriod call
  // rather than shared with the Matrix. A strip still passing `{}` there
  // would render the right stage and the wrong count, so this drives a
  // refusal through and asserts the tally moves.
  //
  // RAMP is the only SXO on the roster and the SXO rule reds at 1, so his
  // approved OL on 1 Jan is what makes that day red. Refusing it puts him
  // back at work and the day with him.
  it('counts under-manned days against the live bid states', () => {
    render(<StageBar />)
    const before = screen.getByTestId('undermanned').textContent
    act(() => setBidState('ramp', '2026-01-01', 'refused'))
    const after = screen.getByTestId('undermanned').textContent
    expect(after).not.toBe(before)
    expect(Number(after!.split(' ')[0])).toBe(Number(before!.split(' ')[0]) - 1)
  })
})
