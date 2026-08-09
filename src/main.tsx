import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initStore } from './state/store'
import { Matrix } from './ui/Matrix'

initStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Matrix />
  </StrictMode>,
)
