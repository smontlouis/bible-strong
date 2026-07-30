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
    url: cdnUrl('bibles/bible-step.json.zip'),
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
      url: cdnUrl('bibles/bible-step-interlinear-fr.sqlite.zip'),
      entry: 'bible-step-interlinear-fr.sqlite',
      archiveSha256: 'ce838424d8216cf38294e312090fcfb93219b74d26170bcbda3a593c609affaf',
      archiveBytes: 22341508,
      contentSha256: 'ccdd3b82ceb1a4cdc24a3b1a503cd04601310191430b680d3089d98287b1b58f',
      contentBytes: 54296576,
      schemaVersion: 5,
      verseCount: 31210,
      textRevision,
      textSha256,
    },
    en: {
      url: cdnUrl('bibles/bible-step-interlinear-en.sqlite.zip'),
      entry: 'bible-step-interlinear-en.sqlite',
      archiveSha256: 'ababa969bc4aaa2aed464b391beff3a85f189626989fbbc3c99beb9a03ddd4ff',
      archiveBytes: 22735720,
      contentSha256: '21707289025e9b907e87d5af56d1aefb10036e16164dccf03cc09c15d6f84462',
      contentBytes: 55119872,
      schemaVersion: 5,
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
