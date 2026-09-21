export const ARRIVAL_ZOOM_DELAY_MS = 500
export const ARRIVAL_FADE_MS = 500
export const ARRIVAL_DURATION_MS = 1000

/** null holds the distant view; undefined leaves normal camera controls in charge. */
export function arrivalZoom(
  startedAt: number | null | undefined,
  now: number,
  minimum: number,
  target: number
) {
  if (startedAt === undefined) return undefined
  if (startedAt === null) return minimum
  const progress = Math.max(
    0,
    Math.min(1, (now - startedAt - ARRIVAL_ZOOM_DELAY_MS) / ARRIVAL_DURATION_MS)
  )
  if (progress === 1) return undefined
  const eased = progress * progress * (3 - 2 * progress)
  return minimum + (target - minimum) * eased
}
