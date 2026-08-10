import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getState, initStore, setRole } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('editing who somebody is', () => {
  it('offers no editing to a member', () => {
    render(<Matrix />)
    expect(screen.queryByTestId('person-ramp')).toBeNull()
  })

  it('opens a sheet on the callsign for an admin', () => {
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('person-ramp'))
    expect(screen.getByTestId('person-sheet')).toBeTruthy()
    expect(screen.getByTestId('person-category').textContent).toBe('OPSP(S)')
  })

  // The category is DERIVED, so changing the seat changes it — that is the
  // whole reason the sheet edits seat and band rather than the category.
  it('changes the category by changing the seat it derives from', () => {
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('person-tata'))
    expect(screen.getByTestId('person-category').textContent).toBe('IP')
    fireEvent.click(screen.getByTestId('seat-wso'))
    expect(screen.getByTestId('person-category').textContent).toBe('IWSO')
    expect(getState().people.find(p => p.id === 'tata')!.seat).toBe('wso')
  })

  it('changes the category by changing the band', () => {
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('person-tata'))
    fireEvent.click(screen.getByTestId('band-ops'))
    expect(screen.getByTestId('person-category').textContent).toBe('OPSP')
  })

  it('tags and untags SXO, and the grid follows', () => {
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('person-tata'))
    fireEvent.click(screen.getByTestId('person-sxo'))
    expect(screen.getByTestId('person-category').textContent).toBe('IP(S)')
    expect(screen.getByTestId('person-tata').textContent).toContain('IP(S)')

    fireEvent.click(screen.getByTestId('person-sxo'))
    expect(screen.getByTestId('person-category').textContent).toBe('IP')
  })

  // The SXO row counts heads that hold the qualification. Adding one has to
  // move it, or the tag would be decoration rather than a fact.
  it('moves the SXO count when somebody gains the qualification', () => {
    setRole('admin')
    render(<Matrix />)
    const before = screen.getByTestId('count-sxo-2026-01-05').textContent
    fireEvent.click(screen.getByTestId('person-tata'))
    fireEvent.click(screen.getByTestId('person-sxo'))
    expect(screen.getByTestId('count-sxo-2026-01-05').textContent).not.toBe(before)
  })

  // ...and the CATEGORY count must not move with it, because SXO sits on top
  // of a category rather than instead of one.
  it('leaves the category count alone when SXO is added', () => {
    setRole('admin')
    render(<Matrix />)
    const before = screen.getByTestId('count-ip-2026-01-05').textContent
    fireEvent.click(screen.getByTestId('person-tata'))
    fireEvent.click(screen.getByTestId('person-sxo'))
    expect(screen.getByTestId('count-ip-2026-01-05').textContent).toBe(before)
  })

  it('moves the category counts when a seat changes', () => {
    setRole('admin')
    render(<Matrix />)
    const before = screen.getByTestId('count-ip-2026-01-05').textContent
    fireEvent.click(screen.getByTestId('person-tata'))
    fireEvent.click(screen.getByTestId('seat-wso'))
    expect(screen.getByTestId('count-ip-2026-01-05').textContent).not.toBe(before)
  })

  it('survives a reload', () => {
    const backend = memoryBackend()
    initStore(backend)
    setRole('admin')
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('person-tata'))
    fireEvent.click(screen.getByTestId('seat-wso'))
    initStore(backend)
    expect(getState().people.find(p => p.id === 'tata')!.seat).toBe('wso')
  })
})
