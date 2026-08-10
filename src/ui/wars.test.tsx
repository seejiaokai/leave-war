import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getState, initStore, selectWar, setRole } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Topbar } from './Chrome'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('switching leave war', () => {
  it('lists every war, with the current one selected', () => {
    render(<Topbar />)
    const picker = screen.getByTestId('war-picker') as HTMLSelectElement
    expect([...picker.options].map(o => o.textContent)).toEqual(['JAN - DEC 26', 'JAN - DEC 27'])
    expect(picker.value).toBe(getState().wars[0].period.id)
  })

  it('switches the war on screen', () => {
    render(<Topbar />)
    fireEvent.change(screen.getByTestId('war-picker'), {
      target: { value: getState().wars[1].period.id },
    })
    expect(getState().period.name).toBe('JAN - DEC 27')
  })

  // The matrix has to follow. It reads `period`, `grid` and `states` from the
  // store, which the store republishes for whichever war is current — so
  // this is really a test that the republication happens.
  it('repaints the grid when the war changes', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-ramp-2026-01-01').textContent).toBe('OL')
    act(() => selectWar(getState().wars[1].period.id))
    expect(screen.queryByTestId('cell-ramp-2026-01-01')).toBeNull()
    expect(screen.getByTestId('cell-reset-2027-04-13').textContent).toBe('LL')
  })

  // A balance is the same figure whichever war is being looked at, because
  // entitlements are continuous and wars are only windows onto them.
  it('leaves a balance unchanged when the war changes', () => {
    render(<Matrix />)
    const before = screen.getByTestId('bal-reset').textContent
    act(() => selectWar(getState().wars[1].period.id))
    expect(screen.getByTestId('bal-reset').textContent).toBe(before)
  })

  // RESET opens at 2 annual and has four days pending in Apr–Jun, so his
  // annual balance is −2 — and it reads −2 from the Jan–Mar screen, where
  // none of that leave is visible. That is the whole point.
  it('counts leave from a war that is not on screen', () => {
    render(<Matrix />)
    expect(screen.getByTestId('bal-reset').textContent).toBe('-2')
    expect(screen.getByTestId('bal-reset').className).toContain('neg')
  })
})

describe('creating a leave war', () => {
  it('offers no create control to a member', () => {
    render(<Topbar />)
    expect(screen.queryByTestId('war-new')).toBeNull()
  })

  it('offers one to an admin', () => {
    setRole('admin')
    render(<Topbar />)
    expect(screen.getByTestId('war-new')).toBeTruthy()
  })

  it('creates a war over the span given, and lists it', () => {
    setRole('admin')
    render(<Topbar />)
    fireEvent.click(screen.getByTestId('war-new'))
    fireEvent.change(screen.getByTestId('war-name'), { target: { value: 'JUL 28' } })
    fireEvent.change(screen.getByTestId('war-start'), { target: { value: '2028-07-01' } })
    fireEvent.change(screen.getByTestId('war-end'), { target: { value: '2028-07-31' } })
    fireEvent.click(screen.getByTestId('war-create'))

    expect(getState().wars.some(w => w.period.name === 'JUL 28')).toBe(true)
    const picker = screen.getByTestId('war-picker') as HTMLSelectElement
    expect([...picker.options].map(o => o.textContent)).toContain('JUL 28')
  })

  it('closes the sheet once the war is made', () => {
    setRole('admin')
    render(<Topbar />)
    fireEvent.click(screen.getByTestId('war-new'))
    fireEvent.change(screen.getByTestId('war-name'), { target: { value: 'JUL 28' } })
    fireEvent.change(screen.getByTestId('war-start'), { target: { value: '2028-07-01' } })
    fireEvent.change(screen.getByTestId('war-end'), { target: { value: '2028-07-31' } })
    fireEvent.click(screen.getByTestId('war-create'))
    expect(screen.queryByTestId('war-sheet')).toBeNull()
  })

  // Refusing has to SAY why, or the button reads as broken.
  it('refuses dates that clash with a war that exists, and keeps the sheet open', () => {
    setRole('admin')
    render(<Topbar />)
    fireEvent.click(screen.getByTestId('war-new'))
    fireEvent.change(screen.getByTestId('war-name'), { target: { value: 'CLASH' } })
    fireEvent.change(screen.getByTestId('war-start'), { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByTestId('war-end'), { target: { value: '2026-05-15' } })
    fireEvent.click(screen.getByTestId('war-create'))

    expect(screen.getByTestId('war-sheet')).toBeTruthy()
    expect(getState().wars.every(w => w.period.name !== 'CLASH')).toBe(true)
  })

  // Naming the war is the whole message. The owner typed Apr–Aug 27, was told
  // only "those dates overlap", and reported it as a bug — reasonably, since
  // the dates plainly did not touch 2026 and nothing on screen mentioned the
  // 2027 war that already existed. The clash is with JAN - DEC 27, and the
  // sentence has to say so and say over what dates.
  it('names the war it clashed with, and the span that war covers', () => {
    setRole('admin')
    render(<Topbar />)
    fireEvent.click(screen.getByTestId('war-new'))
    fireEvent.change(screen.getByTestId('war-name'), { target: { value: 'JUL - SEP 27' } })
    fireEvent.change(screen.getByTestId('war-start'), { target: { value: '2027-04-30' } })
    fireEvent.change(screen.getByTestId('war-end'), { target: { value: '2027-08-31' } })
    fireEvent.click(screen.getByTestId('war-create'))

    const said = screen.getByTestId('war-problem').textContent!
    expect(said).toContain('JAN - DEC 27')
    expect(said).toContain('1 Jan 27 – 31 Dec 27')
    expect(said).toContain('30 Apr 27 – 31 Aug 27')
    // And it must be the war actually hit, not simply the first in the list.
    expect(said).not.toContain('JAN - DEC 26')
  })

  it('says why when the range runs backwards', () => {
    setRole('admin')
    render(<Topbar />)
    fireEvent.click(screen.getByTestId('war-new'))
    fireEvent.change(screen.getByTestId('war-name'), { target: { value: 'BACK' } })
    fireEvent.change(screen.getByTestId('war-start'), { target: { value: '2028-07-31' } })
    fireEvent.change(screen.getByTestId('war-end'), { target: { value: '2028-07-01' } })
    fireEvent.click(screen.getByTestId('war-create'))
    expect(screen.getByTestId('war-problem').textContent).toBeTruthy()
  })

  it('cannot be created until it has a name and both dates', () => {
    setRole('admin')
    render(<Topbar />)
    fireEvent.click(screen.getByTestId('war-new'))
    expect(screen.getByTestId('war-create').hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByTestId('war-name'), { target: { value: 'JUL 28' } })
    expect(screen.getByTestId('war-create').hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByTestId('war-start'), { target: { value: '2028-07-01' } })
    fireEvent.change(screen.getByTestId('war-end'), { target: { value: '2028-07-31' } })
    expect(screen.getByTestId('war-create').hasAttribute('disabled')).toBe(false)
  })

  // A new war does not take the screen. Creating next quarter's should not
  // yank the admin out of the one they are working in.
  it('leaves the current war on screen', () => {
    setRole('admin')
    render(<Topbar />)
    const before = getState().currentId
    fireEvent.click(screen.getByTestId('war-new'))
    fireEvent.change(screen.getByTestId('war-name'), { target: { value: 'JUL 28' } })
    fireEvent.change(screen.getByTestId('war-start'), { target: { value: '2028-07-01' } })
    fireEvent.change(screen.getByTestId('war-end'), { target: { value: '2028-07-31' } })
    fireEvent.click(screen.getByTestId('war-create'))
    expect(getState().currentId).toBe(before)
  })
})
