import type { ResourceLanguage } from '~helpers/databaseTypes'

type DictionaryInternalLinkContext = {
  work: string
  resourceId?: string
  dictionaryTitle: string
  language: ResourceLanguage
}

export const createDictionaryInternalLinkRoute = (
  word: string,
  context: DictionaryInternalLinkContext
) => ({
  pathname: '/dictionnary-detail' as const,
  params: {
    word,
    work: context.work,
    ...(context.resourceId ? { resourceId: context.resourceId } : {}),
    dictionaryTitle: context.dictionaryTitle,
    language: context.language,
  },
})
