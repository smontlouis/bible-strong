import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { zoomFromPinch, zoomFromWheel } from './camera-zoom'
import type { Controls } from './game'
import { PointerTap } from './pointer-tap'

export function useCameraZoomGestures(
  zoneRef: RefObject<HTMLElement | null>,
  controlsRef: RefObject<Controls>,
  setOverview: Dispatch<SetStateAction<boolean>>
) {
  useEffect(() => {
    const zone = zoneRef.current
    if (!zone) return

    const touches = new Map<number, { x: number; y: number }>()
    let pinchStartDistance = 0
    let pinchStartZoom = controlsRef.current.zoom
    const tap = new PointerTap()
    const resetPointers = () => {
      tap.reset()
      touches.clear()
    }

    const distance = () => {
      const [first, second] = [...touches.values()]
      return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0
    }
    const beginPinch = () => {
      if (touches.size !== 2) return
      pinchStartDistance = distance()
      pinchStartZoom = controlsRef.current.overview
        ? controlsRef.current.minimumZoom
        : controlsRef.current.zoom
      controlsRef.current.zoom = pinchStartZoom
      setOverview(false)
    }
    const onWheel = (event: WheelEvent) => {
      tap.cancel()
      if (controlsRef.current.shoreEditor?.editing || controlsRef.current.ambientEditor?.editing)
        return
      event.preventDefault()
      controlsRef.current.zoom = zoomFromWheel(
        controlsRef.current.overview ? controlsRef.current.minimumZoom : controlsRef.current.zoom,
        event.deltaY,
        controlsRef.current.minimumZoom,
        event.deltaMode
      )
      setOverview(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (controlsRef.current.shoreEditor?.editing || controlsRef.current.ambientEditor?.editing)
        return
      if (event.button !== 0 || controlsRef.current.paused) return
      tap.start(event.pointerId, { x: event.clientX, y: event.clientY }, performance.now())
      if (event.pointerType !== 'touch') return
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      zone.setPointerCapture(event.pointerId)
      beginPinch()
    }
    const onPointerMove = (event: PointerEvent) => {
      tap.move({ x: event.clientX, y: event.clientY })
      if (!touches.has(event.pointerId)) return
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.size !== 2) return
      event.preventDefault()
      controlsRef.current.zoom = zoomFromPinch(
        pinchStartZoom,
        pinchStartDistance,
        distance(),
        controlsRef.current.minimumZoom
      )
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (
        tap.end(event.pointerId, { x: event.clientX, y: event.clientY }, performance.now(), event.type !== 'pointerup') &&
        !controlsRef.current.paused
      ) {
        const bounds = zone.getBoundingClientRect()
        controlsRef.current.walkToScreen = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      }
      if (!touches.delete(event.pointerId)) return
      if (zone.hasPointerCapture(event.pointerId)) zone.releasePointerCapture(event.pointerId)
      beginPinch()
    }

    zone.addEventListener('wheel', onWheel, { passive: false })
    zone.addEventListener('pointerdown', onPointerDown)
    zone.addEventListener('pointermove', onPointerMove)
    zone.addEventListener('pointerup', onPointerEnd)
    zone.addEventListener('pointercancel', onPointerEnd)
    window.addEventListener('blur', resetPointers)
    return () => {
      zone.removeEventListener('wheel', onWheel)
      zone.removeEventListener('pointerdown', onPointerDown)
      zone.removeEventListener('pointermove', onPointerMove)
      zone.removeEventListener('pointerup', onPointerEnd)
      zone.removeEventListener('pointercancel', onPointerEnd)
      window.removeEventListener('blur', resetPointers)
      resetPointers()
    }
  }, [controlsRef, setOverview, zoneRef])
}
