import type { Pericope } from '~common/types'
import getBiblePericope from '~helpers/getBiblePericope'
import loadMhyComments from '~helpers/loadMhyComments'
import { loadRedWords } from '~helpers/loadRedWords'
import loadTresorReferences from '~helpers/loadTresorReferences'
import type { VersionCode } from '~state/tabs'
import { mapLocalResourceError, unwrapLocalResourceResult } from './resourceAccessError'
import { getLocalResourceAvailability } from './resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { ResourceAvailability } from './dictionaryAccess'

export type BibleChapterComments = { serializedComments: string }

type RedWordsRange = { start: number; end: number }
export type RedWordsByVerse = Record<string, RedWordsRange[]>

export type TresorReferences = string[]

export type BibleReadingResourceAccess = {
  loadPericope: (version: VersionCode) => Promise<Pericope>
  loadMhyComments: (book: number, chapter: number) => Promise<BibleChapterComments | undefined>
  loadRedWords: (version: VersionCode) => Promise<RedWordsByVerse | null>
  getTresorAvailability?: (language: ResourceLanguage) => Promise<ResourceAvailability>
  loadTresorReferences: (verse: string) => Promise<TresorReferences | undefined>
}

export const localBibleReadingResourceAccess: BibleReadingResourceAccess = {
  loadPericope: getBiblePericope,
  loadMhyComments: async (book, chapter) => {
    const comments = unwrapLocalResourceResult(await loadMhyComments(book, chapter))
    return comments ? { serializedComments: comments.commentaires } : undefined
  },
  loadRedWords,
  getTresorAvailability: async language =>
    (await getLocalResourceAvailability({ kind: 'database', databaseId: 'TRESOR', language }))
      .status === 'available'
      ? { status: 'available' }
      : { status: 'unavailable', recoveries: ['acquire-offline-copy'] },
  loadTresorReferences: async verse => {
    try {
      const references = await loadTresorReferences(verse)
      if (!references?.commentaires) return undefined
      const parsed: unknown = JSON.parse(references.commentaires)
      return Array.isArray(parsed)
        ? parsed.filter((reference): reference is string => typeof reference === 'string')
        : []
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
}
