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
    textRevision: 'bhg-803c482ed06005693547',
    textSha256: '803c482ed06005693547f9ea04a2dcbec4718c1d97ab0c531d60600e4c3a9d8f',
  },
  indexes: {
    fr: {
      path: 'bibles/bible-step-interlinear-fr.sqlite.zip',
      entry: 'bible-step-interlinear-fr.sqlite',
      archiveSha256: '01c757b213c0b467a6ae0d405f7e911ea516eed4159485b591f5b3196e9905ec',
      archiveBytes: 22536568,
      contentSha256: 'e5581a22d74be411e762936a5094e1ad4873c6fe7b98cbb49adc25fbd8ea2294',
      contentBytes: 54296576,
      schemaVersion: 5,
      verseCount: 31210,
      textRevision: 'bhg-803c482ed06005693547',
      textSha256: '803c482ed06005693547f9ea04a2dcbec4718c1d97ab0c531d60600e4c3a9d8f',
    },
    en: {
      path: 'bibles/bible-step-interlinear-en.sqlite.zip',
      entry: 'bible-step-interlinear-en.sqlite',
      archiveSha256: '5bcfee1b51c1a24222475f6bbdae0ea433a620102987a0448a883eed3dacf2eb',
      archiveBytes: 22945644,
      contentSha256: 'be13b954bda6cef2525d46d2421c7ea64f80adf0f0c34e7b767d40eb96526a34',
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
