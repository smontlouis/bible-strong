import { resourceArtifactUrl } from './mobileResourceCatalog'
import type { ResourceLanguage } from './databaseTypes'
import { BHG_INTERLINEAR_PUBLICATION_CATALOG } from './interlinearBiblePublicationCatalog'

export { getInterlinearBiblePublicationLanguages } from './interlinearBiblePublicationCatalog'

export {
  getInterlinearLocalePriority,
  isInterlinearModeEnabled,
  normalizeInterlinearMode,
} from './interlinearDisplayMode'
export type { InterlinearDisplayMode, InterlinearMode } from './interlinearDisplayMode'
export type InterlinearBibleVersionId = 'BHG'

export type InterlinearPublicationArtifact = {
  url: string
  entry: string
  archiveSha256: string
  archiveBytes: number
  contentSha256: string
  contentBytes: number
  schemaVersion: number
  verseCount: number
  textRevision: string
  textSha256: string
}

export type InterlinearBiblePublication = {
  applicationVersionId: InterlinearBibleVersionId
  datasetId: 'STEP'
  sourceVersion: 'TAHOT/TAGNT'
  attribution: string
  license: 'CC BY 4.0'
  sourceUrl: string
  verseCount: number
  tokenCount: number
  segmentCount: number
  identityCount: number
  canonical: InterlinearPublicationArtifact
  indexes: Record<ResourceLanguage, InterlinearPublicationArtifact>
}

const catalog = BHG_INTERLINEAR_PUBLICATION_CATALOG

export const BHG_INTERLINEAR_PUBLICATION: InterlinearBiblePublication = {
  applicationVersionId: catalog.applicationVersionId,
  datasetId: catalog.datasetId,
  sourceVersion: catalog.sourceVersion,
  attribution: catalog.attribution,
  license: catalog.license,
  sourceUrl: catalog.sourceUrl,
  verseCount: catalog.verseCount,
  tokenCount: catalog.tokenCount,
  segmentCount: catalog.segmentCount,
  identityCount: catalog.identityCount,
  canonical: {
    ...catalog.canonical,
    url: resourceArtifactUrl(catalog.canonical.path),
  },
  indexes: {
    fr: {
      ...catalog.indexes.fr,
      url: resourceArtifactUrl(catalog.indexes.fr.path),
    },
    en: {
      ...catalog.indexes.en,
      url: resourceArtifactUrl(catalog.indexes.en.path),
    },
  },
}

export const isInterlinearCapableBibleVersion = (
  versionId: string
): versionId is InterlinearBibleVersionId => versionId === 'BHG'

export const getInterlinearBiblePublication = (): InterlinearBiblePublication =>
  BHG_INTERLINEAR_PUBLICATION
