import layout from './timelineLayout.json'

/** A card with a picture, drawn over the years the event lasts. */
export const LAYOUT_CARD = 1
/** A card that keeps its minimum width however long the event lasts. */
export const LAYOUT_FIXED_WIDTH = 2

/**
 * How the study workspace draws an event: first year, last year and flags. The Timeline
 * publication only carries a dating in words, so this mirrors the timeline bundled with
 * the workspace; `scripts/generate-timeline-layout.mjs` rebuilds it. Years are those of
 * the drawing: what is still to come is given a year after the present.
 */
export const TIMELINE_LAYOUT: Readonly<
  Record<string, readonly [startYear: number, endYear: number, flags: number]>
> = layout as unknown as Record<string, [number, number, number]>
