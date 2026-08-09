import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initStore } from './state/store'
import { StageBar, Topbar } from './ui/Chrome'
import { Matrix } from './ui/Matrix'
import './ui/theme.css'

initStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Topbar />
    <StageBar />
    <Matrix />
  </StrictMode>,
)
