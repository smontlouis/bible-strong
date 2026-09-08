import { useLayoutEffect, useRef, type ReactNode } from 'react'
import './transitions.css'

export default function PanelTransition({
  children,
  direction,
}: {
  children: ReactNode
  direction: 'forward' | 'backward'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    ref.current?.parentElement?.closest('.bs-filter-options')?.scrollTo({ top: 0 })
  }, [])
  return (
    <div ref={ref} className="bs-panel-screen" data-direction={direction}>
      {children}
    </div>
  )
}
