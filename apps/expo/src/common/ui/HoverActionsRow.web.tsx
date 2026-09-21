import { useEffect, useState, type ReactNode } from 'react'

/** Mouse hover and keyboard focus reveal actions without making each row a tab stop. */
const HoverActionsRow = ({
  children,
  showOnTouch = true,
}: {
  children: (showActions: boolean) => ReactNode
  showOnTouch?: boolean
}) => {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const [touchOnly, setTouchOnly] = useState(false)

  useEffect(() => {
    if (!window.matchMedia) return
    const query = window.matchMedia('(hover: none)')
    const update = () => setTouchOnly(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
      onPointerEnter={event => {
        if (event.pointerType !== 'touch') setHovered(true)
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={event => setFocused(event.target.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
      onTouchStart={() => {
        setHovered(false)
        setTouched(true)
      }}
    >
      {children(hovered || focused || (showOnTouch && (touchOnly || touched)))}
    </div>
  )
}

export default HoverActionsRow
