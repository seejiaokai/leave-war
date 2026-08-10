import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getState, initStore, setDayEvent, setRole } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('the two event lines', () => {
  it('gives every day two of them', () => {
    render(<Matrix />)
    expect(screen.getByTestId('event-row-0')).toBeTruthy()
    expect(screen.getByTestId('event-row-1')).toBeTruthy()
    expect(screen.getByTestId('event-0-2026-01-05')).toBeTruthy()
    expect(screen.getByTestId('event-1-2026-01-05')).toBeTruthy()
  })

  // The seed marks public holidays on line 1, so the row is not empty on
  // first run and the surface is visible without anyone typing.
  it('shows what the seed already put there', () => {
    render(<Matrix />)
    expect(screen.getByTestId('event-0-2026-01-01').textContent).toBe('PH')
  })

  // These are the scheduler's facts about a day, not something a bidder
  // writes about themselves — but the whole squadron has to READ them, or
  // nobody knows why a week is a bad week to ask for.
  it('is read-only for a member and editable for an admin', () => {
    render(<Matrix />)
    expect(screen.queryByTestId('event-in-0-2026-01-05')).toBeNull()
    expect(screen.getByTestId('event-0-2026-01-01').textContent).toBe('PH')

    setRole('admin')
    render(<Matrix />)
    expect(screen.getAllByTestId('event-in-0-2026-01-05').length).toBeGreaterThan(0)
  })

  it('writes what an admin types, on the line they typed it', () => {
    setRole('admin')
    render(<Matrix />)
    fireEvent.change(screen.getByTestId('event-in-0-2026-01-05'), { target: { value: 'CO visit' } })
    fireEvent.change(screen.getByTestId('event-in-1-2026-01-05'), { target: { value: 'Range closure' } })
    const day = getState().period.days.find(d => d.date === '2026-01-05')!
    expect(day.events).toEqual(['CO visit', 'Range closure'])
  })

  it('leaves the other line alone', () => {
    setRole('admin')
    render(<Matrix />)
    fireEvent.change(screen.getByTestId('event-in-1-2026-01-01'), { target: { value: 'Parade' } })
    expect(getState().period.days.find(d => d.date === '2026-01-01')!.events).toEqual(['PH', 'Parade'])
  })

  it('leaves every other day alone', () => {
    setRole('admin')
    render(<Matrix />)
    fireEvent.change(screen.getByTestId('event-in-0-2026-01-05'), { target: { value: 'CO visit' } })
    expect(getState().period.days.find(d => d.date === '2026-01-06')!.events).toEqual(['', ''])
  })

  it('marks a day that has an event, and one that does not', () => {
    setRole('admin')
    render(<Matrix />)
    expect(screen.getByTestId('event-0-2026-01-01').className).toContain('has')
    expect(screen.getByTestId('event-0-2026-01-05').className).not.toContain('has')
    fireEvent.change(screen.getByTestId('event-in-0-2026-01-05'), { target: { value: 'CO visit' } })
    expect(screen.getByTestId('event-0-2026-01-05').className).toContain('has')
  })

  it('survives a reload', () => {
    const backend = memoryBackend()
    initStore(backend)
    setRole('admin')
    setDayEvent('2026-01-05', 0, 'CO visit')
    initStore(backend)
    expect(getState().period.days.find(d => d.date === '2026-01-05')!.events[0]).toBe('CO visit')
  })

  it('refuses a member, and a date the war does not hold', () => {
    expect(setDayEvent('2026-01-05', 0, 'CO visit')).toBe(false)
    setRole('admin')
    expect(setDayEvent('2030-01-05', 0, 'CO visit')).toBe(false)
    expect(setDayEvent('2026-01-05', 0, 'CO visit')).toBe(true)
  })

  // The events belong to the WAR, like everything else in a period.
  it('belongs to the war it was written in', () => {
    setRole('admin')
    setDayEvent('2026-01-05', 0, 'CO visit')
    expect(getState().wars[0].period.days.find(d => d.date === '2026-01-05')!.events[0]).toBe('CO visit')
    expect(getState().wars[1].period.days[0].events).toEqual(['', ''])
  })
})
