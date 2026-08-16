import type { Pericope } from '~common/types'
import getBiblePericope from '~helpers/getBiblePericope'
import loadMhyComments from '~helpers/loadMhyComments'
import { loadRedWords } from '~helpers/loadRedWords'
import loadTresorReferences from '~helpers/loadTresorReferences'
import type { VersionCode } from '~state/tabs'
import { mapLocalResourceError, unwrapLocalResourceResult } from './resourceAccessError'
import { getLocalResourceAvailability } from './resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { ResourceAvailability } from './resourceModel'
import { usesCanonicalBibleExtras } from '~helpers/strongBiblePublications'
import { versionHasPericope } from '~helpers/pericopes'
import { versionHasRedWords } from '~helpers/redWords'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'

export type BibleChapterComments = { serializedComments: string }

type RedWordsRange = { start: number; end: number }
export type RedWordsByVerse = Record<string, RedWordsRange[]>

export type TresorReferences = string[]

export type BibleReadingAvailability =
  | { status: 'available' }
  | { status: 'unsupported' }
  | {
      status: 'unavailable'
      reason: 'offline-copy-required' | 'invalid-offline-copy'
      recoveryIdentity: OfflineCopyIdentity
    }

export type BibleReadingResourceAccess = {
  getPericopeAvailability?: (version: VersionCode) => Promise<BibleReadingAvailability>
  getMhyAvailability?: (language: ResourceLanguage) => Promise<BibleReadingAvailability>
  getRedWordsAvailability?: (version: VersionCode) => Promise<BibleReadingAvailability>
  loadPericope: (version: VersionCode) => Promise<Pericope>
  loadMhyComments: (book: number, chapter: number) => Promise<BibleChapterComments | undefined>
  loadRedWords: (version: VersionCode) => Promise<RedWordsByVerse | null>
  getTresorAvailability?: (language: ResourceLanguage) => Promise<ResourceAvailability>
  loadTresorReferences: (verse: string) => Promise<TresorReferences | undefined>
}

const mapReadingAvailability = async (
  identity: OfflineCopyIdentity
): Promise<BibleReadingAvailability> => {
  const availability = await getLocalResourceAvailability(identity)
  if (availability.status === 'available') return { status: 'available' }
  return {
    status: 'unavailable',
    reason: availability.status === 'missing' ? 'offline-copy-required' : 'invalid-offline-copy',
    recoveryIdentity: identity,
  }
}

export const localBibleReadingResourceAccess: BibleReadingResourceAccess = {
  getPericopeAvailability: version => {
    if (usesCanonicalBibleExtras(version)) {
      return mapReadingAvailability({ kind: 'bible', versionId: version })
    }
    if (!versionHasPericope(version)) return Promise.resolve({ status: 'unsupported' })
    return getLocalResourceAvailability({ kind: 'bible-pericope', versionId: version }).then(
      availability =>
        availability.status === 'available'
          ? { status: 'available' }
          : {
              status: 'unavailable',
              reason:
                availability.status === 'missing'
                  ? 'offline-copy-required'
                  : 'invalid-offline-copy',
              recoveryIdentity: { kind: 'bible', versionId: version },
            }
    )
  },
  getMhyAvailability: language =>
    language === 'fr'
      ? mapReadingAvailability({ kind: 'database', databaseId: 'MHY', language: 'fr' })
      : Promise.resolve({ status: 'unsupported' }),
  getRedWordsAvailability: version => {
    if (usesCanonicalBibleExtras(version)) return Promise.resolve({ status: 'available' })
    if (!versionHasRedWords(version)) return Promise.resolve({ status: 'unsupported' })
    return getLocalResourceAvailability({ kind: 'bible-red-words', versionId: version }).then(
      availability =>
        availability.status === 'available'
          ? { status: 'available' }
          : {
              status: 'unavailable',
              reason:
                availability.status === 'missing'
                  ? 'offline-copy-required'
                  : 'invalid-offline-copy',
              recoveryIdentity: { kind: 'bible', versionId: version },
            }
    )
  },
  loadPericope: getBiblePericope,
  loadMhyComments: async (book, chapter) => {
    const comments = unwrapLocalResourceResult(await loadMhyComments(book, chapter))
    return comments ? { serializedComments: comments.commentaires } : undefined
  },
  loadRedWords,
  getTresorAvailability: async language => {
    const availability = await getLocalResourceAvailability({
      kind: 'database',
      databaseId: 'TRESOR',
      language,
    })
    if (availability.status === 'available') return { status: 'available' }
    return {
      status: 'unavailable',
      reason: availability.status === 'missing' ? 'offline-copy-required' : 'invalid-offline-copy',
      recoveries:
        availability.status === 'missing'
          ? ['acquire-offline-copy']
          : ['acquire-offline-copy', 'manage-offline-copies'],
    }
  },
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
