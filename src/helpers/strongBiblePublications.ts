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
  }
  strong: PublicationArtifact & {
    strongRevision: string
    verseCount: number
    occurrenceCount: number
    unalignedOccurrenceCount: number
    identityCount: number
    lexemeAssignmentCount: number
    lexemeCount: number
    noteCount: number
  }
}

export const STRONG_BIBLE_PUBLICATIONS: Record<StrongBibleVersionId, StrongBiblePublication> = {
  LSG: {
    applicationVersionId: 'LSG',
    datasetId: 'LSG',
    sourceVersion: 'SG1910',
    sourceSha256: 'ca3899a49bee30400082f24505cb67a0f4e5e77949c9116cc914243d5ffad43b',
    canonical: {
      url: cdnUrl('bibles/bible-lsg.json.zip'),
      entry: 'bible-lsg.json',
      archiveSha256: '78dc334d1c021f9703d79ab7d16d63f53cc38ef5e32bc47e0e13620d0aae101b',
      archiveBytes: 1441912,
      contentSha256: 'f895a7bcef8953f21b5e9b1f3a55fd0f65775f0e4cc099a06e8e181a66400dc2',
      contentBytes: 5723026,
      textRevision: 'lsg-73e0f16a00ec8777bf33',
      textSha256: '73e0f16a00ec8777bf3399155acb6b70dddd45f33ebdfa7da3955d25e1f1ed75',
      schemaVersion: 2,
      verseCount: 31171,
    },
    strong: {
      url: cdnUrl('bibles/bible-lsg-strong.sqlite.zip'),
      entry: 'bible-lsg-strong.sqlite',
      archiveSha256: 'a276de5b7824f40feb021f9e3a96b6bd79e0081530c78143f8b8b3ba41dbd1f3',
      archiveBytes: 11892564,
      contentSha256: 'd890c3d87cdf91bb4c34f334f483c4735373456b2535b386b4040415c9f57259',
      contentBytes: 28397568,
      textRevision: 'lsg-73e0f16a00ec8777bf33',
      textSha256: '73e0f16a00ec8777bf3399155acb6b70dddd45f33ebdfa7da3955d25e1f1ed75',
      schemaVersion: 1,
      strongRevision: '4bb3c591f740fc7c8a19e7309731edee0d7108b9506af934eeea3ed69275a2e3',
      verseCount: 31171,
      occurrenceCount: 417322,
      unalignedOccurrenceCount: 8093,
      identityCount: 691827,
      lexemeAssignmentCount: 417322,
      lexemeCount: 10453,
      noteCount: 0,
    },
  },
  DBY: {
    applicationVersionId: 'DBY',
    datasetId: 'DBY',
    sourceVersion: 'DARBY',
    sourceSha256: 'f26d738b114cb9a251697f56c74996cf10de39d295cab27df2644fa788d081d8',
    canonical: {
      url: cdnUrl('bibles/bible-dby.json.zip'),
      entry: 'bible-dby.json',
      archiveSha256: '039995b418fe68d3828974a1959937cb438a07872cddb347f78acd53420608e2',
      archiveBytes: 1716441,
      contentSha256: '9feda162d049976f90506dc0e4b9eeacb9ed6d748c19727c6fac5c76f95e5de0',
      contentBytes: 8351965,
      textRevision: 'dby-db8ec3f9a46444931547',
      textSha256: 'db8ec3f9a464449315471bb46119a8d594da8f8abae7228b0ef7fb431d1da986',
      schemaVersion: 2,
      verseCount: 31171,
    },
    strong: {
      url: cdnUrl('bibles/bible-dby-strong.sqlite.zip'),
      entry: 'bible-dby-strong.sqlite',
      archiveSha256: 'a27db027a6bbb65b25c062581a8ffdfb1176f78ee528eb7388a064a6720d56d9',
      archiveBytes: 12099811,
      contentSha256: 'dbaa8592acf91db6d9b81c8760f827ffc6b1c509ae61659a508a743f075f052e',
      contentBytes: 29040640,
      textRevision: 'dby-db8ec3f9a46444931547',
      textSha256: 'db8ec3f9a464449315471bb46119a8d594da8f8abae7228b0ef7fb431d1da986',
      schemaVersion: 1,
      strongRevision: '5ab75b01cedceaefd330ba060cd4de7c303ffced517bb9372b947e9e3f4eec83',
      verseCount: 31171,
      occurrenceCount: 417874,
      unalignedOccurrenceCount: 4446,
      identityCount: 693823,
      lexemeAssignmentCount: 417874,
      lexemeCount: 10851,
      noteCount: 6340,
    },
  },
  DBR: {
    applicationVersionId: 'DBR',
    datasetId: 'DBYR',
    sourceVersion: 'DARBYR',
    sourceSha256: '650695dc198504179c5b2488f873c436bc63a44d5144d87d1abcab43d9adeafe',
    canonical: {
      url: cdnUrl('bibles/bible-dbr.json.zip'),
      entry: 'bible-dbr.json',
      archiveSha256: 'a4f8ec9b4f9c7ac6ce6d25f4b7bee886468c0893bcefbb3cc94c480d021c7c77',
      archiveBytes: 1736860,
      contentSha256: '0a631e31a6559b25c6b12ada1999fa75b8de59f510b511eff9f8ad7683482527',
      contentBytes: 8359236,
      textRevision: 'dbr-1efbf4d1a02d983bdee2',
      textSha256: '1efbf4d1a02d983bdee2e8aca22e831330caa5ffd64d2c35d430125e72425356',
      schemaVersion: 2,
      verseCount: 31171,
    },
    strong: {
      url: cdnUrl('bibles/bible-dbr-strong.sqlite.zip'),
      entry: 'bible-dbr-strong.sqlite',
      archiveSha256: '60798b2106b2cbe8bc51f8b7abbf685c16ac03cbf0096e592c0e88c72a75609e',
      archiveBytes: 12203916,
      contentSha256: '05212d53bb49a0bc3da60492ffd5c758df55c27e57a2202dba7a481e6e09babf',
      contentBytes: 29294592,
      textRevision: 'dbr-1efbf4d1a02d983bdee2',
      textSha256: '1efbf4d1a02d983bdee2e8aca22e831330caa5ffd64d2c35d430125e72425356',
      schemaVersion: 1,
      strongRevision: '2bfae9b810f271f0234d6054c0db58fdc8907a1266698e9377f4bd6f5d7d645d',
      verseCount: 31171,
      occurrenceCount: 417236,
      unalignedOccurrenceCount: 6447,
      identityCount: 693041,
      lexemeAssignmentCount: 417236,
      lexemeCount: 10653,
      noteCount: 8845,
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
