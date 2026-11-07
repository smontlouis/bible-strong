import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'

/**
 * What the highlight layer draws of the annotations: each one's version, words, color and mark.
 * The layer measures the page again when it changes, so a color or a mark changed on an open
 * annotation shows at once. Its date is left out: changing an annotation keeps its creation date.
 */
export const getWordAnnotationsLayoutKey = (
  wordAnnotations: WordAnnotationsObj | null | undefined
): string =>
  wordAnnotations
    ? Object.entries(wordAnnotations)
        .map(([id, { version, ranges, color, type }]) =>
          [
            id,
            version,
            color,
            type,
            ...ranges.map(
              ({ verseKey, startWordIndex, endWordIndex }) =>
                `${verseKey}.${startWordIndex}.${endWordIndex}`
            ),
          ].join(':')
        )
        .sort()
        .join(',')
    : ''
