import { useLocalSearchParams } from 'expo-router'

import { parseStrongDetailRouteParams, type StrongDetailPage } from './strongDetailRoutes'

type StrongRouteParams = {
  book?: string
  reference?: string
  strongReference?: string
  strongBibleVersionId?: string
  identityKind?: string
  identityCode?: string
  bibleVersion?: string
  clickedWord?: string
  bibleChapter?: string
  bibleVerse?: string
  morphologyCodes?: string
  entityKey?: string
}

export const useStrongRoute = (page: StrongDetailPage) => {
  const params = useLocalSearchParams<StrongRouteParams>()
  const { context, entityKey } = parseStrongDetailRouteParams(params)
  const identity = JSON.stringify([page, context, entityKey])

  return {
    context,
    identity,
    entityKey,
  }
}
