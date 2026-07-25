import { cdnUrl } from './firebase'
import type { ResourceLanguage } from './databaseTypes'

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

const textSha256 = '0b52f772b5484ee4c420d9234b760cb2aec022e1add3e0e23fb6b65ee513f811'
const textRevision = `bhg-${textSha256.slice(0, 20)}`
const attribution =
  'Données créées par STEPBible.org à partir des travaux de Tyndale House Cambridge'

export const BHG_INTERLINEAR_PUBLICATION: InterlinearBiblePublication = {
  applicationVersionId: 'BHG',
  datasetId: 'STEP',
  sourceVersion: 'TAHOT/TAGNT',
  attribution,
  license: 'CC BY 4.0',
  sourceUrl: 'https://github.com/STEPBible/STEPBible-Data',
  verseCount: 31210,
  tokenCount: 443239,
  segmentCount: 607175,
  identityCount: 868863,
  canonical: {
    url: cdnUrl('bibles/bible-step.json.zip?v=5d7b283e3e20'),
    entry: 'bible-step.json',
    archiveSha256: '5d7b283e3e20ec748844acfe46877bae7e4e6045d4e4455116f6218a54b18fd6',
    archiveBytes: 1783949,
    contentSha256: textSha256,
    contentBytes: 7305397,
    schemaVersion: 1,
    verseCount: 31210,
    textRevision,
    textSha256,
  },
  indexes: {
    fr: {
      url: cdnUrl('bibles/bible-step-interlinear-fr.sqlite.zip?v=8dece3156a40'),
      entry: 'bible-step-interlinear-fr.sqlite',
      archiveSha256: '8dece3156a40240dbe5da3ae1e883c25d1ca4b959ba743ac09f1c4b6e8378c15',
      archiveBytes: 19781886,
      contentSha256: '572070e8396d89e5cfd82ca87203ddaa298a6c3b167fab6fd8ef3e3ef0676593',
      contentBytes: 46215168,
      schemaVersion: 3,
      verseCount: 31210,
      textRevision,
      textSha256,
    },
    en: {
      url: cdnUrl('bibles/bible-step-interlinear-en.sqlite.zip?v=280643f41938'),
      entry: 'bible-step-interlinear-en.sqlite',
      archiveSha256: '280643f4193835535d3ac2167a414172b1a01ade3accced9a7a10bbe90c24076',
      archiveBytes: 20176808,
      contentSha256: 'b751644d51e21b624d878515e76e5f095ce725dcd164e7ad863a722f9173b285',
      contentBytes: 47038464,
      schemaVersion: 3,
      verseCount: 31210,
      textRevision,
      textSha256,
    },
  },
}

export const isInterlinearCapableBibleVersion = (
  versionId: string
): versionId is InterlinearBibleVersionId => versionId === 'BHG'

export const getInterlinearBiblePublication = (): InterlinearBiblePublication =>
  BHG_INTERLINEAR_PUBLICATION
