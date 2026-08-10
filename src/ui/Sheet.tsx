// The sheet every decision in this app is made in, and the backdrop that
// dismisses it.
//
// Closing a sheet used to be its own ✕ or nothing, so a tap on the grid
// behind it — which is what most people try first — did nothing at all. The
// owner hit that on the counter sheet (10 Aug 26).
//
// The scrim lives HERE, in the wrapper, rather than in each of the seven
// places a sheet is opened: a sheet cannot be written without one, which is a
// stronger guarantee than a component everybody has to remember to add beside
// their own. It is transparent rather than dimmed — these sheets never dimmed
// the grid, and the manning counts behind an open sheet are exactly what
// somebody is reading while they decide.

import type { ReactNode } from 'react'
import './bidpicker.css'

export function Sheet({
  testid,
  label,
  onClose,
  children,
}: {
  testid: string
  label: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      {/* Not a button and not focusable: it carries nothing a screen reader
          needs, and every sheet already has a real labelled ✕. This is a
          pointer convenience on top of that, never the only way out. */}
      <div className="sheetscrim" data-testid="sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div className="bidsheet" data-testid={testid} role="dialog" aria-label={label}>
        {children}
      </div>
    </>
  )
}
