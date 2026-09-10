export function horizontalWheelDelta(
  event: {
    deltaX: number
    deltaY: number
    deltaMode: number
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
  },
  metrics: { position: number; extent: number; viewport: number; lineHeight: number }
) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.deltaX !== 0 || !event.deltaY)
    return 0
  const delta =
    event.deltaY *
    (event.deltaMode === 1 ? metrics.lineHeight : event.deltaMode === 2 ? metrics.viewport : 1)
  const remaining = delta > 0 ? metrics.extent - metrics.position : metrics.position
  return remaining > 1 ? Math.sign(delta) * Math.min(Math.abs(delta), remaining) : 0
}
