import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'

type RelatedStrongNavigationParams = {
  isInTab: boolean
  stepCode: string
  strongBibleVersionId?: StrongBibleVersionId
  bibleVersion?: string
}

export const resolveRelatedStrongNavigation = ({
  isInTab,
  stepCode,
  strongBibleVersionId,
  bibleVersion,
}: RelatedStrongNavigationParams) => {
  const book = stepCode.startsWith('G') ? 40 : 1
  const identity = {
    book,
    identityKind: 'dstrong' as const,
    identityCode: stepCode,
    reference: stepCode,
  }

  if (isInTab) {
    return {
      mode: 'update-tab' as const,
      identity,
    }
  }

  return {
    mode: 'push-route' as const,
    route: {
      pathname: '/strong' as const,
      params: {
        book: String(book),
        reference: stepCode,
        identityKind: 'dstrong' as const,
        identityCode: stepCode,
        strongBibleVersionId,
        bibleVersion,
      },
    },
  }
}
