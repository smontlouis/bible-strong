import type { StrongLexiconEntityRelation } from '~features/resources/strongLexiconAccess'
import type { Verse } from '~common/types'
import { getBook } from '~helpers/bibleBookCatalog'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { createStrongDetailRoute, type StrongDetailRouteContext } from './strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from './strongReferenceNavigation'

export const useStrongRouteNavigation = (context: StrongDetailRouteContext) => {
  const pushRouteOnce = usePushRouteOnce()

  const openBibleReference = (osis: string) => {
    const route = getBibleViewRouteForStrongOsisReference(osis)
    if (route) pushRouteOnce(route)
  }

  const openStrong = (stepCode: string) => {
    pushRouteOnce(
      createStrongDetailRoute('index', {
        book: stepCode.startsWith('G') ? 40 : 1,
        identityKind: 'dstrong',
        identityCode: stepCode,
        reference: stepCode,
        strongBibleVersionId: context.strongBibleVersionId,
        bibleVersion: context.bibleVersion,
      })
    )
  }

  const openEntityRelation = (relation: StrongLexiconEntityRelation) => {
    if (!relation.targetUniqueName) return
    pushRouteOnce(
      createStrongDetailRoute('entity', context, {
        entityKey: relation.targetUniqueName,
      })
    )
  }

  const openConcordanceVerse = (verse: Verse, version?: string) => {
    const bookNumber = Number(verse.Livre)
    const verseNumber = Number(verse.Verset)
    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify(getBook(bookNumber)),
        chapter: String(verse.Chapitre),
        verse: String(verseNumber),
        focusVerses: JSON.stringify([verseNumber]),
        version,
        strongMode: 'visible',
      },
    })
  }

  return {
    openBibleReference,
    openStrong,
    openEntityRelation,
    openConcordanceVerse,
  }
}
