import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { initStore, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('count rows', () => {
  it('shows one row per rule plus the set rule', () => {
    render(<Matrix />)
    expect(screen.getByTestId('count-sets')).toBeTruthy()
    expect(screen.getByTestId('count-ip')).toBeTruthy()
    expect(screen.getByTestId('count-sxo')).toBeTruthy()
  })

  it('shows the available figure for a day', () => {
    render(<Matrix />)
    // Three IPs seeded (TATA, MILES, RESET). TATA is on FS on 1 Jan, and SC
    // duty is at work but off the flying programme, so two remain available.
    expect(screen.getByTestId('count-ip-2026-01-01').textContent).toBe('2')
  })

  it('counts a half day as a half, which the spreadsheet could not', () => {
    setCell('cross', '2026-02-05', 'AM')
    render(<Matrix />)
    expect(screen.getByTestId('count-opsw-2026-02-05').textContent).toBe('4.5')
  })

  it('paints a breached count red', () => {
    for (const id of ['tata', 'miles', 'reset']) setCell(id, '2026-02-05', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).toContain('red')
  })

  it('paints a thin but unbroken count amber', () => {
    setCell('tata', '2026-02-05', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).toContain('amber')
  })

  it('leaves a healthy count unpainted', () => {
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).not.toMatch(/amber|red/)
  })
})
