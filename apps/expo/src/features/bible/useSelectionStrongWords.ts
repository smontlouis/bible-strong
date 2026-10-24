import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import type { Verse } from '~common/types'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import { localQueryOptions } from '~helpers/queryOptions'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import { areStrongIdentitiesEqual } from '~helpers/strongIdentities'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { AnnotatedWordRange } from './annotationWords'
import { collectSelectionStrongWords, type SelectionStrongWord } from './selectionStrongWords'

export type SelectionStrongWordPreview = SelectionStrongWord & {
  original?: string
  transliteration?: string
}

export type SelectionStrongWords =
  | { status: 'none' }
  /** The version's words are not aligned with the Strong entries. */
  | { status: 'unsupported' }
  | { status: 'loading' }
  /** Offline, without the Offline copy of the version's Strong numbers. */
  | { status: 'unavailable' }
  | { status: 'available'; words: SelectionStrongWordPreview[] }

const getChapterKey = (verseKey: string) => verseKey.split('-').slice(0, 2).join('-')

/**
 * The Hebrew and Greek words under the selected words, read from the version's Strong numbers:
 * those the reader already shows when they are on, else those of the Offline copy or the network.
 */
export default function useSelectionStrongWords(
  version: string | undefined,
  ranges: readonly AnnotatedWordRange[],
  verses: readonly Verse[]
): SelectionStrongWords {
  const resources = useResourceAccess()
  const language = useAtomValue(resourcesLanguageAtom).STRONG
  const isSupported = !!version && isStrongCapableBibleVersion(version)
  const rangesKey = ranges
    .map(range => `${range.verseKey}:${range.charStart}-${range.charEnd}`)
    .join('|')

  const query = useQuery({
    queryKey: ['annotation-strong-words', version, language, rangesKey],
    enabled: isSupported && ranges.length > 0,
    ...localQueryOptions,
    queryFn: async (): Promise<SelectionStrongWords> => {
      if (!version || !isStrongCapableBibleVersion(version)) return { status: 'unsupported' }
      const verseByKey = new Map(
        verses.map(verse => [`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`, verse])
      )
      const verseKeys = [...new Set(ranges.map(range => range.verseKey))]
      const spansByVerseKey: Record<string, readonly StrongBibleSpan[]> = {}

      // The reader holds the spans of the verses it shows with their Strong numbers.
      const missing = verseKeys.filter(verseKey => {
        const spans = verseByKey.get(verseKey)?.StrongSpans
        if (spans) spansByVerseKey[verseKey] = spans
        return !spans
      })
      for (const chapterKey of new Set(missing.map(getChapterKey))) {
        const chapterVerseKeys = missing.filter(key => getChapterKey(key) === chapterKey)
        const [book, chapter] = chapterKey.split('-').map(Number)
        const result = await resources.strongBible.loadChapterSpans({
          currentVersionId: version,
          defaultVersionId: version,
          fallbackVersionIds: [],
          book,
          chapter,
        })
        // Spans of another version, or of another revision of its text, fall on other words.
        const textRevision = verseByKey.get(chapterVerseKeys[0])?.TextRevision
        if (
          result.status !== 'available' ||
          result.provenance.versionId !== version ||
          (textRevision && result.textRevision && textRevision !== result.textRevision)
        ) {
          return { status: 'unavailable' }
        }
        for (const verseKey of chapterVerseKeys) {
          const verseNumber = Number(verseKey.split('-')[2])
          spansByVerseKey[verseKey] = result.spansByVerse[verseNumber] ?? []
        }
      }

      const words = collectSelectionStrongWords(
        ranges,
        spansByVerseKey,
        Object.fromEntries(verseKeys.map(key => [key, verseByKey.get(key)?.Texte ?? '']))
      )
      // Without the lexicon, a word still opens its entry: it shows its number alone.
      const previews = words.length
        ? await resources.strongLexicon
            .loadPreview(
              words.map(word => word.identity),
              language
            )
            .catch(() => [])
        : []
      return {
        status: 'available',
        words: words.map(word => {
          const preview = previews.find(candidate =>
            areStrongIdentitiesEqual(candidate.selectedIdentity, word.identity)
          )
          return preview
            ? { ...word, original: preview.original, transliteration: preview.transliteration }
            : word
        }),
      }
    },
  })

  if (ranges.length === 0) return { status: 'none' }
  if (!isSupported) return { status: 'unsupported' }
  if (query.data) return query.data
  return query.isError ? { status: 'unavailable' } : { status: 'loading' }
}
