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
      archiveSha256: 'ce838424d8216cf38294e312090fcfb93219b74d26170bcbda3a593c609affaf',
      archiveBytes: 22341508,
      contentSha256: 'ccdd3b82ceb1a4cdc24a3b1a503cd04601310191430b680d3089d98287b1b58f',
      contentBytes: 54296576,
      schemaVersion: 5,
      verseCount: 31210,
      textRevision: 'bhg-0b52f772b5484ee4c420',
      textSha256: '0b52f772b5484ee4c420d9234b760cb2aec022e1add3e0e23fb6b65ee513f811',
    },
    en: {
      path: 'bibles/bible-step-interlinear-en.sqlite.zip',
      entry: 'bible-step-interlinear-en.sqlite',
      archiveSha256: 'ababa969bc4aaa2aed464b391beff3a85f189626989fbbc3c99beb9a03ddd4ff',
      archiveBytes: 22735720,
      contentSha256: '21707289025e9b907e87d5af56d1aefb10036e16164dccf03cc09c15d6f84462',
      contentBytes: 55119872,
      schemaVersion: 5,
      verseCount: 31210,
      textRevision: 'bhg-0b52f772b5484ee4c420',
      textSha256: '0b52f772b5484ee4c420d9234b760cb2aec022e1add3e0e23fb6b65ee513f811',
    },
  },
} as const

export type InterlinearBiblePublicationLanguage =
  keyof typeof BHG_INTERLINEAR_PUBLICATION_CATALOG.indexes

export const getInterlinearBiblePublicationLanguages =
  (): InterlinearBiblePublicationLanguage[] => ['en', 'fr']
