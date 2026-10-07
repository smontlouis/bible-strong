// How the drawn timeline is travelled: a pressed mouse throws it and lets it glide, a wheel
// moves through time, and anything else leaves the browser's own scrolling in charge.

/** A pointer has to travel this far before a press becomes a drag. */
const DRAG_THRESHOLD = 5
/** The share of its speed a glide keeps from one frame to the next. */
const GLIDE_FRICTION = 0.94
/** Pixels per millisecond under which a glide has come to rest. */
const GLIDE_REST = 0.02
/** How much of the way to its target a wheel travel covers in one frame. */
const WHEEL_EASE = 0.2
const FRAME = 1000 / 60
const LINE_HEIGHT = 32

export type TimelineTravel = {
  /** Moves the view to a position; smoothly unless the reader asked for less motion. */
  goTo: (left: number, top?: number) => void
  /** Stops any movement the reader did not just ask for. */
  rest: () => void
  dispose: () => void
}

/**
 * Makes a scrolling element travel like a map. `ignore` names what keeps its own pointer
 * and wheel: panels laid over the timeline.
 */
export const createTimelineTravel = (
  scroller: HTMLElement,
  ignore: (target: EventTarget | null) => boolean
): TimelineTravel => {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let frame = 0
  // Where a wheel is taking the view, and how far it has got. The position is kept apart
  // from the element, which rounds what it is given and would stall the last pixels.
  let wheel: { target: number; position: number } | undefined

  // Whatever moved the view by itself stops, and forgets where it was going: the next
  // movement starts from where the view really is.
  const rest = () => {
    cancelAnimationFrame(frame)
    frame = 0
    wheel = undefined
  }

  // A throw: the view keeps the speed of the pointer and slows down by itself.
  const glide = (velocityX: number, velocityY: number) => {
    let vx = velocityX
    let vy = velocityY
    let last = performance.now()
    const step = (now: number) => {
      const elapsed = Math.min(now - last, 64)
      last = now
      scroller.scrollLeft -= vx * elapsed
      scroller.scrollTop -= vy * elapsed
      const kept = GLIDE_FRICTION ** (elapsed / FRAME)
      vx *= kept
      vy *= kept
      frame = Math.hypot(vx, vy) > GLIDE_REST ? requestAnimationFrame(step) : 0
    }
    frame = requestAnimationFrame(step)
  }

  // A wheel names where to go; the view eases there, so notches do not jump.
  const easeToWheelTarget = () => {
    if (!wheel) return
    const remaining = wheel.target - wheel.position
    if (Math.abs(remaining) < 0.5) {
      scroller.scrollLeft = wheel.target
      wheel = undefined
      frame = 0
      return
    }
    wheel.position += remaining * WHEEL_EASE
    scroller.scrollLeft = wheel.position
    frame = requestAnimationFrame(easeToWheelTarget)
  }
  const onWheel = (event: WheelEvent) => {
    // Pinching zooms the page.
    if (event.ctrlKey || event.shiftKey || ignore(event.target)) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      // A sideways gesture already scrolls the timeline: it takes over from any travel.
      rest()
      return
    }
    event.preventDefault()
    const distance = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT : event.deltaY
    if (calm) {
      scroller.scrollLeft += distance
      return
    }
    if (!wheel) {
      rest()
      wheel = { target: scroller.scrollLeft, position: scroller.scrollLeft }
    }
    const limit = scroller.scrollWidth - scroller.clientWidth
    wheel.target = Math.min(Math.max(wheel.target + distance, 0), limit)
    if (!frame) frame = requestAnimationFrame(easeToWheelTarget)
  }
  // A finger scrolls the timeline by itself, from where it is.
  const onTouchStart = () => rest()

  let drag:
    | { x: number; y: number; left: number; top: number; moved: boolean }
    | undefined
  let speed = { x: 0, y: 0, at: 0, vx: 0, vy: 0 }
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || ignore(event.target)) return
    rest()
    drag = {
      x: event.clientX,
      y: event.clientY,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      moved: false,
    }
    speed = { x: event.clientX, y: event.clientY, at: event.timeStamp, vx: 0, vy: 0 }
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.moved = true
    scroller.dataset.dragging = 'true'
    scroller.scrollLeft = drag.left - dx
    scroller.scrollTop = drag.top - dy
    const elapsed = event.timeStamp - speed.at
    if (elapsed > 0) {
      // Recent movement weighs more, so the throw follows the last gesture of the hand.
      speed = {
        x: event.clientX,
        y: event.clientY,
        at: event.timeStamp,
        vx: 0.7 * ((event.clientX - speed.x) / elapsed) + 0.3 * speed.vx,
        vy: 0.7 * ((event.clientY - speed.y) / elapsed) + 0.3 * speed.vy,
      }
    }
  }
  const onPointerUp = (event: PointerEvent) => {
    if (!drag) return
    const { moved } = drag
    drag = undefined
    delete scroller.dataset.dragging
    if (!moved) return
    // The click that ends a drag must not open what lies under the pointer.
    scroller.addEventListener('click', click => click.preventDefault(), {
      capture: true,
      once: true,
    })
    // A hand that stopped before letting go did not throw.
    const paused = event.timeStamp - speed.at > 80
    if (!calm && !paused) glide(speed.vx, speed.vy)
  }
  // Links and pictures would otherwise start a native drag of their own.
  const onDragStart = (event: DragEvent) => event.preventDefault()

  scroller.addEventListener('wheel', onWheel, { passive: false })
  scroller.addEventListener('touchstart', onTouchStart, { passive: true })
  scroller.addEventListener('pointerdown', onPointerDown)
  scroller.addEventListener('dragstart', onDragStart)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)

  return {
    rest,
    goTo: (left, top) => {
      rest()
      scroller.scrollTo({ left, top, behavior: calm ? 'auto' : 'smooth' })
    },
    dispose: () => {
      rest()
      scroller.removeEventListener('wheel', onWheel)
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('pointerdown', onPointerDown)
      scroller.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    },
  }
}
