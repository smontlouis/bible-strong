import type { ReactNode } from 'react'
import './transitions.css'

export default function PanelTransition({
  children,
  direction,
}: {
  children: ReactNode
  direction: 'forward' | 'backward'
}) {
  return (
    <div className="bs-panel-screen" data-direction={direction}>
      {children}
    </div>
  )
}
