import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import type { StrongIdentity } from '~helpers/strongIdentities'

type StrongCardDetailContext = {
  book: string | number
  identity: StrongIdentity
  strongBibleVersionId?: StrongBibleVersionId
  bibleVersion?: string
  bibleChapter?: number
  bibleVerse?: number
  clickedWord?: string
  morphologyCodes?: string[]
}

export const createStrongCardDetailRouteParams = ({
  book,
  identity,
  strongBibleVersionId,
  bibleVersion,
  bibleChapter,
  bibleVerse,
  clickedWord,
  morphologyCodes,
}: StrongCardDetailContext) => ({
  book: String(Number(book)),
  identityKind: identity.kind,
  identityCode: identity.code,
  strongBibleVersionId,
  bibleVersion,
  clickedWord,
  bibleChapter: bibleChapter == null ? undefined : String(bibleChapter),
  bibleVerse: bibleVerse == null ? undefined : String(bibleVerse),
  morphologyCodes: morphologyCodes?.length ? JSON.stringify(morphologyCodes) : undefined,
})
