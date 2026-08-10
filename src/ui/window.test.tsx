import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceStage, getState, initStore, setRole } from '../state/store'
import { memoryBackend } from '../state/storage'
import { StageBar } from './Chrome'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('the bidding window on screen', () => {
  it('says which dates the squadron may bid on', () => {
    render(<StageBar />)
    expect(screen.getByTestId('bid-window').textContent).toBe('1 Jan 26 – 31 Mar 26')
  })

  // A member sees the fact; only an admin can change it. Same chip, because
  // it is the same fact and there is no second thing to show.
  it('is a control for an admin and a label for a member', () => {
    render(<StageBar />)
    expect((screen.getByTestId('bid-window') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('role-toggle')) // member -> admin
    expect((screen.getByTestId('bid-window') as HTMLButtonElement).disabled).toBe(false)
  })

  // A draft or closed war is shut to the squadron on every date. A window
  // advertised beside "BIDDING CLOSED" would contradict the chip next to it.
  it('is absent unless the war is open', () => {
    render(<StageBar />)
    expect(screen.queryByTestId('bid-window')).toBeTruthy()
    fireEvent.click(screen.getByTestId('stage-advance')) // open -> closed
    expect(screen.queryByTestId('bid-window')).toBeNull()
  })

  it('moves the window through the picker', () => {
    setRole('admin')
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('bid-window'))
    // Opens on January, because that is where the window currently starts.
    // Walking to July is what an admin actually does, so the test does it.
    expect(screen.getByTestId('window-month').textContent).toBe('JANUARY 2026')
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByTestId('window-next-month'))
    fireEvent.click(screen.getByTestId('window-day-2026-07-01'))
    fireEvent.click(screen.getByTestId('window-next-month'))
    fireEvent.click(screen.getByTestId('window-day-2026-08-31'))
    fireEvent.click(screen.getByTestId('window-apply'))

    expect(getState().period.bidFrom).toBe('2026-07-01')
    expect(getState().period.bidTo).toBe('2026-08-31')
    expect(screen.queryByTestId('window-sheet')).toBeNull()
    expect(screen.getByTestId('bid-window').textContent).toBe('1 Jul 26 – 31 Aug 26')
  })

  it('opens the whole year when the selection is cleared', () => {
    setRole('admin')
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('bid-window'))
    fireEvent.click(screen.getByTestId('window-clear'))
    fireEvent.click(screen.getByTestId('window-apply'))
    expect(getState().period.bidFrom).toBeNull()
    expect(screen.getByTestId('bid-window').textContent).toBe('THE WHOLE YEAR')
  })

  // The picker's bounds are the war's own span, so the refusal it would
  // otherwise need cannot be reached from the interface at all.
  it('offers no date outside the war', () => {
    setRole('admin')
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('bid-window'))
    fireEvent.click(screen.getByTestId('window-prev-month')) // back into 2025
    expect((screen.getByTestId('window-day-2025-12-31') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('the grid shows which days are open', () => {
  it('locks the columns a member may not bid on, and not the ones they may', () => {
    render(<Matrix />)
    expect(screen.getByTestId('head-2026-02-11').className).not.toContain('locked')
    expect(screen.getByTestId('cell-ramp-2026-02-11').className).not.toContain('locked')
    expect(screen.getByTestId('head-2026-08-11').className).toContain('locked')
    expect(screen.getByTestId('cell-ramp-2026-08-11').className).toContain('locked')
  })

  // The window holds the squadron to the part of the year the schedule has
  // reached. Drawing a lock on the admin's screen would be a lie about it.
  it('locks nothing for an admin', () => {
    setRole('admin')
    render(<Matrix />)
    expect(screen.getByTestId('head-2026-08-11').className).not.toContain('locked')
    expect(screen.getByTestId('cell-ramp-2026-08-11').className).not.toContain('locked')
  })

  it('offers no bid sheet on a locked day, and one on an open day', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-ramp-2026-08-11'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
    fireEvent.click(screen.getByTestId('cell-ramp-2026-02-11'))
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })

  // The lock is a property of the DATE and the role, not of the stage alone —
  // so an admin closing the war locks every column for the member, window or
  // no window.
  it('locks the whole year for a member once the war closes', () => {
    setRole('admin')
    advanceStage() // open -> closed
    setRole('member')
    render(<Matrix />)
    expect(screen.getByTestId('head-2026-02-11').className).toContain('locked')
    expect(screen.getByTestId('head-2026-08-11').className).toContain('locked')
  })
})
