import type { ResourceLanguage } from '~helpers/databaseTypes'

export type PublicDictionaryRoute = {
  language: ResourceLanguage
  work: string
  entryId: number
  slug: string
}

const segment = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim().toLocaleLowerCase()

const isSlug = (value: string | undefined): value is string =>
  !!value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)

export const createDictionaryArticleSlug = (word: string): string =>
  word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'article'

export const parsePublicDictionaryRoute = (params: {
  language?: string | string[]
  work?: string | string[]
  entryId?: string | string[]
  slug?: string | string[]
}): PublicDictionaryRoute | undefined => {
  const language = segment(params.language)
  const work = segment(params.work)
  const entryId = Number(segment(params.entryId))
  const slug = segment(params.slug)
  return (language === 'fr' || language === 'en') &&
    isSlug(work) &&
    Number.isSafeInteger(entryId) &&
    entryId > 0 &&
    isSlug(slug)
    ? { language, work, entryId, slug }
    : undefined
}

export const buildPublicDictionaryPath = ({
  language,
  work,
  entryId,
  word,
}: Omit<PublicDictionaryRoute, 'slug'> & { word: string }): string => {
  const slug = createDictionaryArticleSlug(word)
  if (!isSlug(work) || !Number.isSafeInteger(entryId) || entryId <= 0)
    throw new Error('PUBLIC_DICTIONARY_ROUTE_INVALID')
  return `/dictionary/${language}/${work}/${entryId}/${slug}`
}
