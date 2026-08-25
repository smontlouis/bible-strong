import type { StrongReference } from '~common/types'
import type { StrongTab } from '~state/tabs'

export type StrongDetailPage = 'index' | 'entity' | 'dictionary' | 'related' | 'concordance'

export type StrongDetailRouteContext = StrongTab['data']

export type StrongDetailRouteOptions = {
  entityKey?: string
}

const STRONG_DETAIL_PATHNAMES = {
  index: '/strong',
  entity: '/strong/entity',
  dictionary: '/strong/dictionary',
  related: '/strong/related',
  concordance: '/strong/concordance',
} as const

const compactParams = (params: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )

export const createStrongDetailRoute = (
  page: StrongDetailPage,
  context: StrongDetailRouteContext,
  options: StrongDetailRouteOptions = {}
) => ({
  pathname: STRONG_DETAIL_PATHNAMES[page],
  params: compactParams({
    book: context.book == null ? undefined : String(context.book),
    reference: context.reference,
    strongReference: context.strongReference ? JSON.stringify(context.strongReference) : undefined,
    strongBibleVersionId: context.strongBibleVersionId,
    identityKind: context.identityKind,
    identityCode: context.identityCode,
    bibleVersion: context.bibleVersion,
    clickedWord: context.clickedWord,
    bibleChapter: context.bibleChapter == null ? undefined : String(context.bibleChapter),
    bibleVerse: context.bibleVerse == null ? undefined : String(context.bibleVerse),
    morphologyCodes: context.morphologyCodes?.length
      ? JSON.stringify(context.morphologyCodes)
      : undefined,
    entityKey: options.entityKey,
  }),
})

const firstString = (value: unknown): string | undefined =>
  typeof value === 'string'
    ? value
    : Array.isArray(value) && typeof value[0] === 'string'
      ? value[0]
      : undefined

const positiveNumber = (value: unknown): number | undefined => {
  const number = Number(firstString(value))
  return Number.isInteger(number) && number > 0 ? number : undefined
}

const parseJson = <T>(value: unknown): T | undefined => {
  const serialized = firstString(value)
  if (!serialized) return undefined
  try {
    return JSON.parse(serialized) as T
  } catch {
    return undefined
  }
}

export const parseStrongDetailRouteParams = (params: Record<string, unknown>) => {
  const morphologyCodes = parseJson<unknown>(params.morphologyCodes)
  const strongReference = parseJson<StrongReference>(params.strongReference)
  const context = Object.fromEntries(
    Object.entries({
      book: positiveNumber(params.book),
      reference: firstString(params.reference),
      strongReference,
      strongBibleVersionId: firstString(params.strongBibleVersionId) as
        | StrongDetailRouteContext['strongBibleVersionId']
        | undefined,
      identityKind: firstString(params.identityKind) as StrongDetailRouteContext['identityKind'],
      identityCode: firstString(params.identityCode),
      bibleVersion: firstString(params.bibleVersion),
      clickedWord: firstString(params.clickedWord),
      bibleChapter: positiveNumber(params.bibleChapter),
      bibleVerse: positiveNumber(params.bibleVerse),
      morphologyCodes:
        Array.isArray(morphologyCodes) && morphologyCodes.every(code => typeof code === 'string')
          ? morphologyCodes
          : undefined,
    }).filter(([, value]) => value !== undefined)
  ) as StrongDetailRouteContext

  return {
    context,
    entityKey: firstString(params.entityKey),
  }
}
