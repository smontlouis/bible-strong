import {
  buildTimelinePeriodBands,
  timelineWidth,
  type TimelineBand,
} from '@bible-strong/resource-domain/timeline-stage'

// The periods, their scales and colours are shared with the application (ADR-0097). What
// follows belongs to the page: the room it keeps for its title and for its ending.

/** The room the drawing keeps before its first year, for its title. */
export const TIMELINE_INTRO_WIDTH = 600
/** The room it keeps after its last year, for what follows the timeline. */
export const TIMELINE_OUTRO_WIDTH = 520

/** The whole timeline on its axis, every period at its scale. */
export const TIMELINE_BANDS: readonly TimelineBand[] =
  buildTimelinePeriodBands(TIMELINE_INTRO_WIDTH)

/** The width of the drawing, from its title to what follows the last year. */
export const TIMELINE_CANVAS_WIDTH = timelineWidth(TIMELINE_BANDS) + TIMELINE_OUTRO_WIDTH
