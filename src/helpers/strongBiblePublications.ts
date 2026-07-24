import { cdnUrl } from './firebase'

export type StrongMode = 'visible' | 'hidden'
export type StrongBibleVersionId = 'LSG' | 'DBY' | 'DBR'
export type StrongBibleDatasetId = 'LSG' | 'DBY' | 'DBYR'

export const STRONG_BIBLE_FALLBACK_PRIORITY = [
  'LSG',
  'DBY',
  'DBR',
] as const satisfies readonly StrongBibleVersionId[]

type PublicationArtifact = {
  url: string
  entry: string
  archiveSha256: string
  archiveBytes: number
  contentSha256: string
  contentBytes: number
  textRevision: string
  textSha256: string
  schemaVersion: number
}

export type StrongBiblePublication = {
  applicationVersionId: StrongBibleVersionId
  datasetId: StrongBibleDatasetId
  sourceVersion: 'SG1910' | 'DARBY' | 'DARBYR'
  sourceSha256: string
  canonical: PublicationArtifact & {
    verseCount: number
    noteCount: number
  }
  strong: PublicationArtifact & {
    strongRevision: string
    verseCount: number
    occurrenceCount: number
    unalignedOccurrenceCount: number
    identityCount: number
    lexemeAssignmentCount: number
    lexemeCount: number
  }
}

export const STRONG_BIBLE_PUBLICATIONS: Record<StrongBibleVersionId, StrongBiblePublication> = {
  LSG: {
    applicationVersionId: 'LSG',
    datasetId: 'LSG',
    sourceVersion: 'SG1910',
    sourceSha256: 'ca3899a49bee30400082f24505cb67a0f4e5e77949c9116cc914243d5ffad43b',
    canonical: {
      url: cdnUrl('bibles/bible-lsg.json.zip?v=95a26a36a07b'),
      entry: 'bible-lsg.json',
      archiveSha256: '95a26a36a07b025f400d876caa6d40536dac0327845962b6f82f93207d0b6698',
      archiveBytes: 1455775,
      contentSha256: '6d47f4fda06afa10e2693d21fb9c42e187ef9bbb6f2b5e7ec02760f60d06c175',
      contentBytes: 6065921,
      textRevision: 'lsg-3ead3de401d205b2bedd',
      textSha256: '3ead3de401d205b2beddf35825a8159489a5ce5bed241a98bb277f01b6400af5',
      schemaVersion: 3,
      verseCount: 31171,
      noteCount: 0,
    },
    strong: {
      url: cdnUrl('bibles/bible-lsg-strong.sqlite.zip?v=867a87ec31bb'),
      entry: 'bible-lsg-strong.sqlite',
      archiveSha256: '867a87ec31bb816ec4ac22ca89fcdb878959d6da60ef3bfe916a03df4a207177',
      archiveBytes: 11892615,
      contentSha256: '394a4d88cff3729455ed3ca1735b57069a95baed142b44efae8116a3fa062b14',
      contentBytes: 28393472,
      textRevision: 'lsg-3ead3de401d205b2bedd',
      textSha256: '3ead3de401d205b2beddf35825a8159489a5ce5bed241a98bb277f01b6400af5',
      schemaVersion: 2,
      strongRevision: '5c766d4782bbaf20ad26352b5f4bb2f9a8ada75c150937019cf5eafe2e5e5e4c',
      verseCount: 31171,
      occurrenceCount: 417322,
      unalignedOccurrenceCount: 8093,
      identityCount: 691827,
      lexemeAssignmentCount: 417322,
      lexemeCount: 10453,
    },
  },
  DBY: {
    applicationVersionId: 'DBY',
    datasetId: 'DBY',
    sourceVersion: 'DARBY',
    sourceSha256: 'f26d738b114cb9a251697f56c74996cf10de39d295cab27df2644fa788d081d8',
    canonical: {
      url: cdnUrl('bibles/bible-dby.json.zip?v=6deb3af58294'),
      entry: 'bible-dby.json',
      archiveSha256: '6deb3af582949a7831ba5fdb0c6995edf1ecd588b3de8f869c7e34e0a337b17a',
      archiveBytes: 1896638,
      contentSha256: '5de9412d26731f643d5623a192d176b4ce200f310622190261f039bee5909806',
      contentBytes: 9471142,
      textRevision: 'dby-378293db39001644c8cb',
      textSha256: '378293db39001644c8cb162ebe4076b833c8f82fb3899d860a4c3ad9eba290dc',
      schemaVersion: 3,
      verseCount: 31171,
      noteCount: 6340,
    },
    strong: {
      url: cdnUrl('bibles/bible-dby-strong.sqlite.zip?v=d0055f1df460'),
      entry: 'bible-dby-strong.sqlite',
      archiveSha256: 'd0055f1df460ce0149f5f898a6e5ba2337cf25929cf2c8512cd8de063ab0d305',
      archiveBytes: 11942570,
      contentSha256: '95967a9fad9a968441279ac12f4c79198f10919d52148a32670be3e0c9783737',
      contentBytes: 28487680,
      textRevision: 'dby-378293db39001644c8cb',
      textSha256: '378293db39001644c8cb162ebe4076b833c8f82fb3899d860a4c3ad9eba290dc',
      schemaVersion: 2,
      strongRevision: '06ae8612cecaab29ecfa65575d21851007794413036f4dc27105786ecfc92149',
      verseCount: 31171,
      occurrenceCount: 417874,
      unalignedOccurrenceCount: 4446,
      identityCount: 693823,
      lexemeAssignmentCount: 417874,
      lexemeCount: 10851,
    },
  },
  DBR: {
    applicationVersionId: 'DBR',
    datasetId: 'DBYR',
    sourceVersion: 'DARBYR',
    sourceSha256: '650695dc198504179c5b2488f873c436bc63a44d5144d87d1abcab43d9adeafe',
    canonical: {
      url: cdnUrl('bibles/bible-dbr.json.zip?v=8242dcdab0f6'),
      entry: 'bible-dbr.json',
      archiveSha256: '8242dcdab0f648530a9482dbc527d39db4ba95761d8f74e4f31f5380a36d48f1',
      archiveBytes: 2009114,
      contentSha256: '46b50b4ef3744d1032270f06ac2d97cd7668f3cf387251e29cf7de8c861150dc',
      contentBytes: 9868461,
      textRevision: 'dbr-d2037425159d05a6fe31',
      textSha256: 'd2037425159d05a6fe319c02506803b9d17f61c794f7a4790cb302af15e6380b',
      schemaVersion: 3,
      verseCount: 31171,
      noteCount: 8845,
    },
    strong: {
      url: cdnUrl('bibles/bible-dbr-strong.sqlite.zip?v=026bec64d2fc'),
      entry: 'bible-dbr-strong.sqlite',
      archiveSha256: '026bec64d2fc192b1cfd25acb41c6e8bad9ffdc716673d2ff93828485bd69bd5',
      archiveBytes: 11950148,
      contentSha256: 'b35995522ced10da7a041a7b9dbe08d0a3501909cc74ec14907588731cbcad46',
      contentBytes: 28442624,
      textRevision: 'dbr-d2037425159d05a6fe31',
      textSha256: 'd2037425159d05a6fe319c02506803b9d17f61c794f7a4790cb302af15e6380b',
      schemaVersion: 2,
      strongRevision: '8dea20c02ecacde0f60965e962a8e1aec215f4b318991143276db58283bb5870',
      verseCount: 31171,
      occurrenceCount: 417236,
      unalignedOccurrenceCount: 6447,
      identityCount: 693041,
      lexemeAssignmentCount: 417236,
      lexemeCount: 10653,
    },
  },
}

export const isStrongCapableBibleVersion = (versionId: string): versionId is StrongBibleVersionId =>
  versionId in STRONG_BIBLE_PUBLICATIONS

export const getStrongBiblePublication = (
  versionId: StrongBibleVersionId
): StrongBiblePublication => STRONG_BIBLE_PUBLICATIONS[versionId]

export const getStrongDatasetId = (versionId: string): StrongBibleDatasetId | undefined =>
  isStrongCapableBibleVersion(versionId)
    ? STRONG_BIBLE_PUBLICATIONS[versionId].datasetId
    : undefined

export const resolveStrongBibleVersion = (
  versionId: string,
  strongMode: StrongMode = 'hidden'
): { versionId: string; strongMode: StrongMode } => {
  if (versionId === 'LSGS') {
    return { versionId: 'LSG', strongMode: 'visible' }
  }

  return {
    versionId,
    strongMode: isStrongCapableBibleVersion(versionId) ? strongMode : 'hidden',
  }
}

export const resolveStrongNavigationVersionId = (
  versionId: string
): StrongBibleVersionId | undefined => {
  const resolvedVersionId = resolveStrongBibleVersion(versionId).versionId
  return isStrongCapableBibleVersion(resolvedVersionId) ? resolvedVersionId : undefined
}
