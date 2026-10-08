import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  type MobileResourceCatalog,
  type MobileResourceCatalogEntry,
} from './catalog'

/**
 * What the original-language Bible is, whatever revision is published. The published revision,
 * its archives and the text each index was built for are read from the Artifact catalog.
 */
export const BHG_INTERLINEAR_IDENTITY = {
  applicationVersionId: 'BHG',
  datasetId: 'STEP',
  sourceVersion: 'TAHOT/TAGNT',
  attribution: 'Données créées par STEPBible.org à partir des travaux de Tyndale House Cambridge',
  license: 'CC BY 4.0',
  sourceUrl: 'https://github.com/STEPBible/STEPBible-Data',
} as const

export type InterlinearBiblePublicationLanguage = 'fr' | 'en'

export const getInterlinearBiblePublicationLanguages =
  (): InterlinearBiblePublicationLanguage[] => ['en', 'fr']

export const INTERLINEAR_BIBLE_TEXT_CATALOG_ID = `bible:${BHG_INTERLINEAR_IDENTITY.applicationVersionId}`

export const getInterlinearBibleIndexCatalogId = (
  language: InterlinearBiblePublicationLanguage
): string => `bible-interlinear:${BHG_INTERLINEAR_IDENTITY.applicationVersionId}:${language}`

export type CatalogTextIdentity = {
  textRevision: string
  textSha256: string
}

type TextIdentityDeclaration = Pick<MobileResourceCatalogEntry, 'textRevision' | 'textSha256'>

/** The text a Catalog entry declares, when it declares one completely. */
export const getCatalogTextIdentity = (
  entry: TextIdentityDeclaration | undefined
): CatalogTextIdentity | undefined =>
  entry?.textRevision && entry.textSha256
    ? { textRevision: entry.textRevision, textSha256: entry.textSha256 }
    : undefined

export const isSameCatalogTextIdentity = (
  left: Partial<CatalogTextIdentity> | undefined,
  right: Partial<CatalogTextIdentity> | undefined
): boolean =>
  Boolean(left?.textRevision) &&
  Boolean(left?.textSha256) &&
  left?.textRevision === right?.textRevision &&
  left?.textSha256 === right?.textSha256

/**
 * The text an archive carries or was built for. A catalog that does not declare it — one served
 * before the declaration existed — is completed by another catalog listing the same archive: an
 * archive hash names one immutable file, whichever catalog lists it.
 */
export const resolveCatalogTextIdentity = (
  resourceId: string,
  archiveSha256: string,
  catalogs: readonly MobileResourceCatalog[]
): CatalogTextIdentity | undefined => {
  for (const catalog of catalogs) {
    const entry = catalog.resources[resourceId]
    if (entry?.archiveSha256 !== archiveSha256) continue
    const identity = getCatalogTextIdentity(entry)
    if (identity) return identity
  }
  return undefined
}

export type InterlinearBibleCatalogArtifact = MobileResourceCatalogEntry & {
  /** Text carried (the Bible) or required (an index); unknown when no catalog declares it. */
  text?: CatalogTextIdentity
}

export type InterlinearBibleCatalogPublication = typeof BHG_INTERLINEAR_IDENTITY & {
  text: InterlinearBibleCatalogArtifact
  indexes: Record<InterlinearBiblePublicationLanguage, InterlinearBibleCatalogArtifact>
}

const resolveArtifact = (
  resourceId: string,
  catalog: MobileResourceCatalog,
  fallbackCatalogs: readonly MobileResourceCatalog[]
): InterlinearBibleCatalogArtifact => {
  const entry = catalog.resources[resourceId]
  if (!entry) throw new Error(`INTERLINEAR_BIBLE_CATALOG_ENTRY_MISSING:${resourceId}`)
  const text = resolveCatalogTextIdentity(resourceId, entry.archiveSha256, [
    catalog,
    ...fallbackCatalogs,
  ])
  return { ...entry, ...(text ? { text } : {}) }
}

/**
 * The original-language Bible and its localized indexes as one catalog publishes them.
 * `fallbackCatalogs` only complete a missing text declaration for the same archive.
 */
export const resolveInterlinearBiblePublication = (
  catalog: MobileResourceCatalog = BUNDLED_MOBILE_RESOURCE_CATALOG,
  fallbackCatalogs: readonly MobileResourceCatalog[] = []
): InterlinearBibleCatalogPublication => ({
  ...BHG_INTERLINEAR_IDENTITY,
  text: resolveArtifact(INTERLINEAR_BIBLE_TEXT_CATALOG_ID, catalog, fallbackCatalogs),
  indexes: {
    fr: resolveArtifact(getInterlinearBibleIndexCatalogId('fr'), catalog, fallbackCatalogs),
    en: resolveArtifact(getInterlinearBibleIndexCatalogId('en'), catalog, fallbackCatalogs),
  },
})

/**
 * Indexes a catalog pairs with another text than the one it publishes. A catalog that declares
 * the text of an index must publish that text: a reader brings both to one revision together.
 */
export const findInterlinearBibleCatalogMismatches = (catalog: MobileResourceCatalog): string[] => {
  const mismatches: string[] = []
  for (const [resourceId, entry] of Object.entries(catalog.resources)) {
    const match = /^bible-interlinear:([^:]+):[^:]+$/u.exec(resourceId)
    if (!match) continue
    const index = getCatalogTextIdentity(entry)
    const text = getCatalogTextIdentity(catalog.resources[`bible:${match[1]}`])
    if (!index && !text) continue
    if (!isSameCatalogTextIdentity(index, text)) mismatches.push(resourceId)
  }
  return mismatches
}
