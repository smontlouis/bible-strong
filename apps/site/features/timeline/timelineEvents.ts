import { timelineDatesRank } from './timelineDates'
import { timelinePeriodRank } from './timelinePeriods'

/** What places an event on the timeline. */
export type TimelineOrderKey = { id: string; slug: string; period: string; dates: string }

const sourceRank = (id: string): number =>
  /^\d+$/u.test(id) ? Number(id) : Number.MAX_SAFE_INTEGER

/**
 * Chronological order: the period, then the first year of the event. The publication
 * numbers its events along the narrative, so events of one year keep that order (the
 * trials of Jesus before his crucifixion, all dated 31 AD).
 */
export const compareTimelineEvents = (left: TimelineOrderKey, right: TimelineOrderKey): number =>
  timelinePeriodRank(left.period) - timelinePeriodRank(right.period) ||
  timelineDatesRank(left.dates) - timelineDatesRank(right.dates) ||
  sourceRank(left.id) - sourceRank(right.id) ||
  left.slug.localeCompare(right.slug)

/**
 * The paragraphs of an article. The publication writes plain text: a blank line ends a
 * paragraph, and a single line break stays inside it (a heading above its text).
 */
export const timelineParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/u)
    .map(paragraph =>
      paragraph
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
    )
    .filter(Boolean)

// The publication names its image files. Our media host serves a copy of each, as WebP, at
// the two widths of ADR-0080: `yarn resources:timeline:images` makes and uploads them.
const IMAGE_BASE_URL = 'https://media.bible-strong.app/timeline-images/'
const IMAGE_FILE_PATTERN = /^[^/\\]+\.(?:jpe?g|png|gif|webp)$/iu

const imageUrl = (width: 480 | 1200, file: string): string | undefined =>
  IMAGE_FILE_PATTERN.test(file)
    ? `${IMAGE_BASE_URL}w${width}/${encodeURIComponent(file)}.webp`
    : undefined

/** The public address of an image of the publication; anything but a plain file name has none. */
export const timelineImageUrl = (file: string): string | undefined => imageUrl(1200, file)

/** The small copy of an image, for the cards of the drawn timeline. */
export const timelineThumbnailUrl = (file: string): string | undefined => imageUrl(480, file)
