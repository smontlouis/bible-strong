import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { zoomFromPinch, zoomFromWheel } from './camera-zoom'
import type { Controls } from './game'

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

    const distance = () => {
      const [first, second] = [...touches.values()]
      return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0
    }
    const beginPinch = () => {
      if (touches.size !== 2) return
      pinchStartDistance = distance()
      pinchStartZoom = controlsRef.current.zoom
      setOverview(false)
    }
    const onWheel = (event: WheelEvent) => {
      if (controlsRef.current.shoreEditor?.editing || controlsRef.current.ambientEditor?.editing) return
      event.preventDefault()
      controlsRef.current.zoom = zoomFromWheel(
        controlsRef.current.zoom,
        event.deltaY,
        event.deltaMode
      )
      setOverview(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (controlsRef.current.shoreEditor?.editing || controlsRef.current.ambientEditor?.editing) return
      if (event.pointerType !== 'touch') return
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      zone.setPointerCapture(event.pointerId)
      beginPinch()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!touches.has(event.pointerId)) return
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.size !== 2) return
      event.preventDefault()
      controlsRef.current.zoom = zoomFromPinch(
        pinchStartZoom,
        pinchStartDistance,
        distance()
      )
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (!touches.delete(event.pointerId)) return
      if (zone.hasPointerCapture(event.pointerId)) zone.releasePointerCapture(event.pointerId)
      beginPinch()
    }

    zone.addEventListener('wheel', onWheel, { passive: false })
    zone.addEventListener('pointerdown', onPointerDown)
    zone.addEventListener('pointermove', onPointerMove)
    zone.addEventListener('pointerup', onPointerEnd)
    zone.addEventListener('pointercancel', onPointerEnd)
    return () => {
      zone.removeEventListener('wheel', onWheel)
      zone.removeEventListener('pointerdown', onPointerDown)
      zone.removeEventListener('pointermove', onPointerMove)
      zone.removeEventListener('pointerup', onPointerEnd)
      zone.removeEventListener('pointercancel', onPointerEnd)
      touches.clear()
    }
  }, [controlsRef, setOverview, zoneRef])
}
