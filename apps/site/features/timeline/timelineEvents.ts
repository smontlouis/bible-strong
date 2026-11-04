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
