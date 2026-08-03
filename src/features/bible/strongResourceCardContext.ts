import type { Verse } from '~common/types'
import {
  buildCanonicalStrongVerseRuns,
  type CanonicalStrongVerseRun,
} from '~helpers/canonicalStrongVerse'
import { areStrongIdentitiesEqual, type StrongIdentity } from '~helpers/strongIdentities'
import { getStrongSelectionMorphologyCodes } from '~helpers/strongSelection'

export type StrongResourceCardContext = {
  clickedWord?: string
  morphologyCodes: string[]
}

type StrongVerseRun = Extract<CanonicalStrongVerseRun, { kind: 'strong' }>

export const getStrongResourceCardContext = (
  verse: Pick<Verse, 'Texte' | 'StrongSpans'>,
  identity: StrongIdentity
): StrongResourceCardContext => {
  const matchingRuns = buildCanonicalStrongVerseRuns(verse.Texte, verse.StrongSpans).filter(
    (run): run is StrongVerseRun =>
      run.kind === 'strong' &&
      run.identities.some(candidate => areStrongIdentitiesEqual(candidate, identity))
  )
  const morphologyCodes = [
    ...new Set(
      matchingRuns.flatMap(run =>
        getStrongSelectionMorphologyCodes(run.morphologies ?? [], identity)
      )
    ),
  ]
  const clickedWord = matchingRuns.find(run => run.word)?.word

  return {
    ...(clickedWord ? { clickedWord } : {}),
    morphologyCodes,
  }
}
