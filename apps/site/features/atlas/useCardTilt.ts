import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import {
  adjust,
  clamp,
  drawTextures,
  paint,
  REST,
  restingSprings,
  step,
  type Springs,
} from './AtlasCards'

/**
 * The springs of a card, or of a pack: it tilts under the pointer and its foil follows the light.
 * `element` carries the CSS variables its layers read, `surface` is what the pointer is measured
 * against, and `handlers` go on whatever receives the pointer.
 */
export const useCardTilt = <Element extends HTMLElement, Surface extends HTMLElement>({
  spin = false,
}: { spin?: boolean } = {}) => {
  const element = useRef<Element>(null)
  const surface = useRef<Surface>(null)
  const springs = useRef<Springs>(restingSprings())
  const frame = useRef(0)
  const still = useRef(false)
  const endTimer = useRef(0)
  const pressed = useRef(false)

  const tick = () => {
    let moving = false
    const s = springs.current
    for (const value of Object.values(s)) if (step(value, still.current)) moving = true
    if (s.spin.t === 360 && Math.abs(s.spin.x - 360) < 0.5) {
      s.spin.x = 0
      s.spin.t = 0
      s.spin.v = 0
    }
    if (element.current) paint(element.current, s)
    frame.current = moving ? requestAnimationFrame(tick) : 0
  }
  const kick = () => {
    if (!frame.current) frame.current = requestAnimationFrame(tick)
  }

  const rest = (delay = 400) => {
    window.clearTimeout(endTimer.current)
    endTimer.current = window.setTimeout(() => {
      const s = springs.current
      element.current?.classList.remove('is-interacting')
      s.rx.t = 0
      s.ry.t = 0
      s.gx.t = REST.x
      s.gy.t = REST.y
      s.go.t = REST.shine
      s.gl.t = 0
      s.bx.t = adjust(REST.x, 0, 100, 37, 63)
      s.by.t = adjust(REST.y, 0, 100, 33, 67)
      kick()
    }, delay)
  }

  const tilt = (clientX: number, clientY: number) => {
    const rect = surface.current?.getBoundingClientRect()
    if (!rect) return
    const px = clamp(((clientX - rect.left) / rect.width) * 100)
    const py = clamp(((clientY - rect.top) / rect.height) * 100)
    window.clearTimeout(endTimer.current)
    element.current?.classList.add('is-interacting')
    const s = springs.current
    s.bx.t = adjust(px, 0, 100, 37, 63)
    s.by.t = adjust(py, 0, 100, 33, 67)
    s.rx.t = -((px - 50) / 3.5)
    s.ry.t = (py - 50) / 3.5
    s.gx.t = px
    s.gy.t = py
    s.go.t = 1
    s.gl.t = 1
    kick()
  }

  useEffect(() => {
    drawTextures()
    still.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (element.current) paint(element.current, springs.current)
    if (spin && !still.current) springs.current.spin.t = 360
    kick()
    rest(spin ? 900 : 120)
    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      window.clearTimeout(endTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const release = () => {
    pressed.current = false
    rest(250)
  }

  return {
    element,
    surface,
    springs,
    kick,
    handlers: {
      onPointerDown: (event: ReactPointerEvent) => {
        pressed.current = true
        tilt(event.clientX, event.clientY)
      },
      onPointerMove: (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse' || pressed.current) tilt(event.clientX, event.clientY)
      },
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse') rest()
      },
    },
  }
}
