import VOD from '~assets/bible_versions/bible-vod.json'
import booksDesc2 from '~assets/bible_versions/books-desc-2'
import type { VerseRefContent } from '~common/types'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'
import { loadBibleVerseTexts } from '~features/resources/resourceQueries'
import getVersesContent from '~helpers/getVersesContent'
import { localQueryOptions } from '~helpers/queryOptions'
import type { VersionCode } from '~state/tabs'
import {
  getVerseOfTheDayNumber,
  getVerseOfTheDayQueryKey,
  VERSE_OF_THE_DAY_CACHE_TIME,
} from './verseOfTheDayPolicy'

export type VerseOfTheDayData = VerseRefContent & {
  v: string
  book: number
  chapter: number
  verse: number
}

const versesOfTheDay = VOD as Record<number, string>

export const createVerseOfTheDayQueryOptions = (
  resources: ResourceAccessRegistry,
  version: VersionCode,
  addDay: number
) => {
  const dayOfTheYear = getVerseOfTheDayNumber(addDay)

  return {
    queryKey: getVerseOfTheDayQueryKey(version, addDay),
    queryFn: async (): Promise<VerseOfTheDayData> => {
      const reference = versesOfTheDay[dayOfTheYear]
      const [bookName, chapter, verse] = reference.split('.')
      const book = booksDesc2.find(candidate => candidate[1] === bookName)?.[0]
      const vod = await getVersesContent({
        verses: `${book}-${chapter}-${verse}`,
        version,
        loadVerseTexts: (versionId, verseKeys) =>
          loadBibleVerseTexts(resources, versionId, verseKeys),
      })

      return {
        v: reference,
        book: Number(book),
        chapter: Number(chapter),
        verse: Number(verse),
        ...vod,
      }
    },
    staleTime: Infinity,
    gcTime: VERSE_OF_THE_DAY_CACHE_TIME,
    ...localQueryOptions,
  }
}
