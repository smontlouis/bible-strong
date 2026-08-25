import type { BibleChapterData } from '~features/resources/bibleContentAccess'
import type { Verse } from '~common/types'

type ChapterEntityQueryPlanInput = {
  chapterReady: boolean
  chapterKind?: BibleChapterData['kind']
  contextualInformationDisplay: boolean
  displayedStrongCodes: string[]
  isContextFocused: boolean
  loadedStrongCodes?: string[]
  strongCodesQueryFetched: boolean
}

export type ChapterEntityQueryPlan = {
  codes: string[]
  codesReady: boolean
  shouldCheckAvailability: boolean
  shouldLoadEntities: boolean
  shouldLoadStrongCodes: boolean
}

export const getDisplayedChapterEntityStrongCodes = (verses: Verse[]): string[] => [
  ...new Set(
    verses.flatMap(verse =>
      [...(verse.StrongSpans ?? []), ...(verse.ReverseInterlinearSpans ?? [])].flatMap(span =>
        span.identities.map(identity => identity.code)
      )
    )
  ),
]

export const getChapterEntityQueryPlan = ({
  chapterReady,
  chapterKind,
  contextualInformationDisplay,
  displayedStrongCodes,
  isContextFocused,
  loadedStrongCodes,
  strongCodesQueryFetched,
}: ChapterEntityQueryPlanInput): ChapterEntityQueryPlan => {
  const shouldCheckAvailability = chapterReady && contextualInformationDisplay && !isContextFocused
  const chapterAlreadyContainsStrongCodes =
    chapterKind === 'strong' || chapterKind === 'reverse-interlinear'

  if (chapterAlreadyContainsStrongCodes) {
    return {
      codes: displayedStrongCodes,
      codesReady: shouldCheckAvailability,
      shouldCheckAvailability,
      shouldLoadEntities: shouldCheckAvailability,
      shouldLoadStrongCodes: false,
    }
  }

  return {
    codes: loadedStrongCodes ?? displayedStrongCodes,
    codesReady: shouldCheckAvailability && strongCodesQueryFetched,
    shouldCheckAvailability,
    shouldLoadEntities: shouldCheckAvailability && strongCodesQueryFetched,
    shouldLoadStrongCodes: shouldCheckAvailability,
  }
}
