import type { Pericope } from '~common/types'
import type { DatabaseError } from '~helpers/catchDatabaseError'
import getBiblePericope from '~helpers/getBiblePericope'
import loadMhyComments, { type MhyCommentRow } from '~helpers/loadMhyComments'
import { loadRedWords } from '~helpers/loadRedWords'
import loadTresorReferences from '~helpers/loadTresorReferences'
import type { VersionCode } from '~state/tabs'

export type { MhyCommentRow } from '~helpers/loadMhyComments'

type RedWordsRange = { start: number; end: number }
export type RedWordsByVerse = Record<string, RedWordsRange[]>

export type TresorReferences = {
  commentaires?: string
}

export type BibleReadingResourceAccess = {
  loadPericope: (version: VersionCode) => Promise<Pericope>
  loadMhyComments: (
    book: number,
    chapter: number
  ) => Promise<MhyCommentRow | DatabaseError | undefined>
  loadRedWords: (version: VersionCode) => Promise<RedWordsByVerse | null>
  loadTresorReferences: (verse: string) => Promise<TresorReferences | undefined>
}

export const localBibleReadingResourceAccess: BibleReadingResourceAccess = {
  loadPericope: getBiblePericope,
  loadMhyComments,
  loadRedWords,
  loadTresorReferences,
}
