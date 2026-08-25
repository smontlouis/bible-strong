import type { Verse } from '~common/types'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import {
  buildCanonicalStrongVerseRuns,
  type CanonicalStrongVerseRun,
} from '~helpers/canonicalStrongVerse'
import type { StrongIdentity } from '~helpers/strongIdentities'
import { getStrongSelectionMorphologyCodes } from '~helpers/strongSelection'

export type StrongVerseContext = {
  bibleVersion?: string
  strongBibleVersionId?: StrongBibleVersionId
  book: number
  bibleChapter: number
  bibleVerse: number
  clickedWord?: string
  morphologyCodes: string[]
}

export type StrongWordOccurrence = Pick<StrongVerseContext, 'clickedWord' | 'morphologyCodes'> & {
  identity: StrongIdentity
}

type StrongVerseRun = Extract<CanonicalStrongVerseRun, { kind: 'strong' }>

export const getStrongWordOccurrences = (
  verse: Pick<Verse, 'Texte' | 'StrongSpans'>
): StrongWordOccurrence[] =>
  buildCanonicalStrongVerseRuns(verse.Texte, verse.StrongSpans)
    .filter((run): run is StrongVerseRun => run.kind === 'strong')
    .flatMap(run =>
      run.identities.map(identity => ({
        identity,
        ...(run.contextWord || run.word ? { clickedWord: run.contextWord || run.word } : {}),
        morphologyCodes: getStrongSelectionMorphologyCodes(run.morphologies ?? [], identity),
      }))
    )
