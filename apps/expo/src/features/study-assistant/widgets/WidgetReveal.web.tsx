import { useState, type ReactNode } from 'react'
import './widgets.css'

/**
 * A card placed in an answer being written comes in as the text does, from the top down
 * (`bs-widget-reveal` in widgets.css). The wrapper adds no box of its own, so the card's
 * margins still meet the paragraphs around it. Cards of an answer already written show at once.
 */
export default function WidgetReveal({
  animate,
  children,
}: {
  animate: boolean
  children: ReactNode
}) {
  // Decided once: the card keeps its place in the tree when the animation ends.
  const [running, setRunning] = useState(animate)
  return (
    <div
      className={running ? 'bs-widget-reveal' : undefined}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget) setRunning(false)
      }}
    >
      {children}
    </div>
  )
}
