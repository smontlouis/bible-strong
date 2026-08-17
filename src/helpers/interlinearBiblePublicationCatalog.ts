export const BHG_INTERLINEAR_PUBLICATION_CATALOG = {
  applicationVersionId: 'BHG',
  datasetId: 'STEP',
  sourceVersion: 'TAHOT/TAGNT',
  attribution: 'Données créées par STEPBible.org à partir des travaux de Tyndale House Cambridge',
  license: 'CC BY 4.0',
  sourceUrl: 'https://github.com/STEPBible/STEPBible-Data',
  verseCount: 31210,
  tokenCount: 443239,
  segmentCount: 607175,
  identityCount: 868863,
  canonical: {
    path: 'bibles/bible-step.json.zip',
    entry: 'bible-step.json',
    archiveSha256: '5d7b283e3e20ec748844acfe46877bae7e4e6045d4e4455116f6218a54b18fd6',
    archiveBytes: 1783949,
    contentSha256: '0b52f772b5484ee4c420d9234b760cb2aec022e1add3e0e23fb6b65ee513f811',
    contentBytes: 7305397,
    schemaVersion: 1,
    verseCount: 31210,
    textRevision: 'bhg-0b52f772b5484ee4c420',
    textSha256: '0b52f772b5484ee4c420d9234b760cb2aec022e1add3e0e23fb6b65ee513f811',
  },
  indexes: {
    fr: {
      path: 'bibles/bible-step-interlinear-fr.sqlite.zip',
      entry: 'bible-step-interlinear-fr.sqlite',
      archiveSha256: '327da29583dd5f450176c75644c107419587d69e67fefba12887244b411f188f',
      archiveBytes: 22537142,
      contentSha256: 'df72cfc0a8367e78a64d7e2f154b4d29ef1ded68be203ec802aa76065198595d',
      contentBytes: 54296576,
      schemaVersion: 5,
      verseCount: 31210,
      textRevision: 'bhg-803c482ed06005693547',
      textSha256: '803c482ed06005693547f9ea04a2dcbec4718c1d97ab0c531d60600e4c3a9d8f',
    },
    en: {
      path: 'bibles/bible-step-interlinear-en.sqlite.zip',
      entry: 'bible-step-interlinear-en.sqlite',
      archiveSha256: 'd22e482b24c5623d34ae9ebb39a3dfba3529aede83b2c619a2da6b05cb23fc9b',
      archiveBytes: 22947322,
      contentSha256: '0e9fed0a887d77cb520707123f63f2c14c5eea3b7014154a9650885ddf563133',
      contentBytes: 55119872,
      schemaVersion: 5,
      verseCount: 31210,
      textRevision: 'bhg-803c482ed06005693547',
      textSha256: '803c482ed06005693547f9ea04a2dcbec4718c1d97ab0c531d60600e4c3a9d8f',
    },
  },
} as const

export type InterlinearBiblePublicationLanguage =
  keyof typeof BHG_INTERLINEAR_PUBLICATION_CATALOG.indexes

export const getInterlinearBiblePublicationLanguages =
  (): InterlinearBiblePublicationLanguage[] => ['en', 'fr']
