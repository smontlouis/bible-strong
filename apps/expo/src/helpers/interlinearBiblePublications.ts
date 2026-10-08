import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  MOBILE_RESOURCE_CATALOG,
  resolveMobileResourceArtifactUrl,
  type MobileResourceCatalog,
} from './mobileResourceCatalog'
import type { ResourceLanguage } from './databaseTypes'
import {
  BHG_INTERLINEAR_IDENTITY,
  INTERLINEAR_BIBLE_TEXT_CATALOG_ID,
  resolveCatalogTextIdentity,
  resolveInterlinearBiblePublication,
  type CatalogTextIdentity,
  type InterlinearBibleCatalogArtifact,
} from './interlinearBiblePublicationCatalog'

export { getInterlinearBiblePublicationLanguages } from './interlinearBiblePublicationCatalog'

export {
  getInterlinearLocalePriority,
  isInterlinearModeEnabled,
  normalizeInterlinearMode,
} from './interlinearDisplayMode'
export type { InterlinearDisplayMode, InterlinearMode } from './interlinearDisplayMode'
export type InterlinearBibleVersionId = 'BHG'

/** Text a BHG archive carries, or the text an interlinear index was built for. */
export type InterlinearTextIdentity = CatalogTextIdentity

export type InterlinearPublicationArtifact = {
  url: string
  entry: string
  archiveSha256: string
  archiveBytes: number
  contentSha256: string
  contentBytes: number
  /** Absent when no catalog the application holds declares it for this archive. */
  text?: InterlinearTextIdentity
}

export type InterlinearBiblePublication = {
  applicationVersionId: InterlinearBibleVersionId
  datasetId: 'STEP'
  sourceVersion: 'TAHOT/TAGNT'
  attribution: string
  license: 'CC BY 4.0'
  sourceUrl: string
  text: InterlinearPublicationArtifact
  indexes: Record<ResourceLanguage, InterlinearPublicationArtifact>
}

const toArtifact = (entry: InterlinearBibleCatalogArtifact): InterlinearPublicationArtifact => ({
  url: resolveMobileResourceArtifactUrl(entry),
  entry: entry.entry,
  archiveSha256: entry.archiveSha256,
  archiveBytes: entry.archiveBytes,
  contentSha256: entry.contentSha256,
  contentBytes: entry.contentBytes,
  ...(entry.text ? { text: entry.text } : {}),
})

/**
 * BHG and its interlinear indexes as the catalog the application holds publishes them: the
 * live catalog, or the bundled one when it could not be loaded. Nothing here is compiled into
 * the application but the identity of the resource.
 */
export const getInterlinearBiblePublication = (
  catalog: MobileResourceCatalog = MOBILE_RESOURCE_CATALOG
): InterlinearBiblePublication => {
  const publication = resolveInterlinearBiblePublication(catalog, [BUNDLED_MOBILE_RESOURCE_CATALOG])
  return {
    ...BHG_INTERLINEAR_IDENTITY,
    text: toArtifact(publication.text),
    indexes: {
      fr: toArtifact(publication.indexes.fr),
      en: toArtifact(publication.indexes.en),
    },
  }
}

/** The text an installed BHG archive carries, when a catalog the application holds lists it. */
export const getPublishedInterlinearTextIdentity = (
  archiveSha256: string | undefined,
  catalogs: readonly MobileResourceCatalog[] = [
    MOBILE_RESOURCE_CATALOG,
    BUNDLED_MOBILE_RESOURCE_CATALOG,
  ]
): InterlinearTextIdentity | undefined =>
  archiveSha256
    ? resolveCatalogTextIdentity(INTERLINEAR_BIBLE_TEXT_CATALOG_ID, archiveSha256, catalogs)
    : undefined

export const isInterlinearCapableBibleVersion = (
  versionId: string
): versionId is InterlinearBibleVersionId =>
  versionId === BHG_INTERLINEAR_IDENTITY.applicationVersionId
