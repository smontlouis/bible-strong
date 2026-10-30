import { isResourceLanguage, WEB_APP_ORIGIN, type ResourceLanguage } from '../resources/publicSite'

/** The families of the atlas, each with a page listing its entities (ADR-0091). */
export const ATLAS_FAMILIES = ['people', 'places', 'groups', 'beings', 'others'] as const
export type AtlasFamily = (typeof ATLAS_FAMILIES)[number]

export const isAtlasFamily = (value: string | undefined): value is AtlasFamily =>
  (ATLAS_FAMILIES as readonly string[]).includes(value ?? '')

/** The family of a listed entity: supernatural beings apart, every other kind among the others. */
export const atlasFamilyOf = (
  category: 'person' | 'place' | 'group' | 'supernatural' | 'other'
): AtlasFamily =>
  (
    ({
      person: 'people',
      place: 'places',
      group: 'groups',
      supernatural: 'beings',
      other: 'others',
    }) as const
  )[category]

/**
 * A unique name as it reads in an address: percent-encoded like any segment, but for `@`, which
 * every unique name holds and a path may carry as it is.
 */
export const atlasEntitySegment = (uniqueName: string): string =>
  encodeURIComponent(uniqueName).replace(/%40/gu, '@')

export const buildAtlasPath = (language: ResourceLanguage): string => `/atlas/${language}`

export const buildAtlasFamilyPath = (language: ResourceLanguage, family: AtlasFamily): string =>
  `${buildAtlasPath(language)}/${family}`

export const buildAtlasEntityPath = (language: ResourceLanguage, uniqueName: string): string =>
  `${buildAtlasPath(language)}/${atlasEntitySegment(uniqueName)}`

/** The gallery of every card (ADR-0090), and one card opened over it. */
export const buildAtlasCardsPath = (language: ResourceLanguage): string =>
  `${buildAtlasPath(language)}/cards`

/** A card's id is its entity's unique name, followed by `~stage` for a life stage. */
export const buildAtlasCardPath = (language: ResourceLanguage, id: string): string =>
  `${buildAtlasCardsPath(language)}/${atlasEntitySegment(id)}`

/** The id of a card in its address; `undefined` when it cannot be one. */
export const parseAtlasCardId = (segment: string | undefined): string | undefined => {
  if (!segment) return undefined
  try {
    const id = decodeURIComponent(segment)
    return id.includes('@') ? id : undefined
  } catch {
    return undefined
  }
}

export type AtlasRoute =
  | { language: ResourceLanguage; kind: 'home' }
  | { language: ResourceLanguage; kind: 'family'; family: AtlasFamily }
  | { language: ResourceLanguage; kind: 'entity'; uniqueName: string }

/**
 * Reads `/atlas/:language[/:family | /:uniqueName]`. A unique name always holds `@`, so it never
 * meets a family. Letter case is tolerated in the language and the family only: a unique name is
 * case-sensitive.
 */
export const parseAtlasRoute = (params: {
  language?: string
  name?: string
}): AtlasRoute | undefined => {
  const language = params.language?.toLowerCase()
  if (!isResourceLanguage(language)) return undefined
  if (params.name === undefined) return { language, kind: 'home' }
  const family = params.name.toLowerCase()
  if (isAtlasFamily(family)) return { language, kind: 'family', family }
  let uniqueName: string
  try {
    uniqueName = decodeURIComponent(params.name)
  } catch {
    return undefined
  }
  return uniqueName.includes('@') ? { language, kind: 'entity', uniqueName } : undefined
}

/** The canonical path of a parsed route. */
export const buildAtlasRoutePath = (route: AtlasRoute): string =>
  route.kind === 'home'
    ? buildAtlasPath(route.language)
    : route.kind === 'family'
      ? buildAtlasFamilyPath(route.language, route.family)
      : buildAtlasEntityPath(route.language, route.uniqueName)

/** The same entity in the study workspace. */
export const buildWebAppEntityUrl = (uniqueName: string): string =>
  `${WEB_APP_ORIGIN}/strong/entity/${encodeURIComponent(uniqueName)}`
