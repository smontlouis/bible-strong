import type { Verse } from '~common/types'
import type { ResourceLanguage } from '~helpers/databaseTypes'

import type { BibleChapterSourceResult } from './bibleChapterSource'
import {
  ResourceAccessError,
  resourceAccessErrorFromBibleChapterUnavailable,
} from './resourceAccessError'
import { warnAboutRecoverableResourceIntegrity } from './recoverableIntegrity'

type InterlinearChapterRequest = { book: number; chapter: number }
type LoadInterlinearBaseChapter = (
  request: InterlinearChapterRequest
) => Promise<BibleChapterSourceResult>

type InterlinearText = { textRevision?: string; textSha256?: string }
type InterlinearBaseText = InterlinearText & {
  verses: Verse[]
  presentation?: 'canonical' | 'legacy-sidecars'
}

/** Tokens match a text only when both name the same revision; an unnamed text matches nothing. */
export const isInterlinearTextMatch = (text: InterlinearText, tokens: InterlinearText): boolean =>
  Boolean(text.textRevision) &&
  text.textRevision === tokens.textRevision &&
  (text.textSha256 === undefined ||
    tokens.textSha256 === undefined ||
    text.textSha256 === tokens.textSha256)

/**
 * Chooses the text BHG tokens are laid on: the text the reader holds when the tokens were built
 * for it, otherwise the same chapter read online. When neither names the revision of the
 * tokens, the presentation fails: word offsets are never applied to another text (ADR-0079).
 */
export const resolveInterlinearBaseText = async ({
  held,
  tokens,
  request,
  locale,
  loadBaseChapter,
}: {
  held: InterlinearBaseText
  tokens: InterlinearText
  request: InterlinearChapterRequest
  locale?: ResourceLanguage
  loadBaseChapter?: LoadInterlinearBaseChapter
}): Promise<InterlinearBaseText> => {
  if (isInterlinearTextMatch(held, tokens)) return held
  warnAboutRecoverableResourceIntegrity('interlinear-bible-text-revision-mismatch', {
    locale,
    book: request.book,
    chapter: request.chapter,
    bibleTextRevision: held.textRevision,
    interlinearTextRevision: tokens.textRevision,
  })
  if (!loadBaseChapter) throw new ResourceAccessError('INTEGRITY_FAILURE')
  const base = await loadBaseChapter(request)
  if (base.status !== 'available') {
    throw resourceAccessErrorFromBibleChapterUnavailable(
      base.reason,
      base.recoveries,
      base.diagnostics
    )
  }
  // Text and index are published one after the other: between the two, they disagree.
  if (!isInterlinearTextMatch(base, tokens)) throw new ResourceAccessError('TEMPORARY_UNAVAILABLE')
  return {
    verses: base.verses,
    ...(base.presentation ? { presentation: base.presentation } : {}),
    ...(base.textRevision ? { textRevision: base.textRevision } : {}),
    ...(base.textSha256 ? { textSha256: base.textSha256 } : {}),
  }
}
