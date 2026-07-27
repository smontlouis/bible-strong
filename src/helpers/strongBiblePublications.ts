import { cdnUrl } from './firebase'
import {
  REVERSE_INTERLINEAR_STEP_CONTRACT,
  STRONG_BIBLE_REVERSE_INTERLINEAR_CANDIDATES,
} from './strongBibleReverseInterlinearCandidate'

export type StrongMode = 'visible' | 'hidden' | 'reverse-interlinear'
export type StrongBibleVersionId =
  | 'LSG'
  | 'DBY'
  | 'DBR'
  | 'KJV'
  | 'NASB2020'
  | 'NASB1995'
  | 'BSB'
  | 'ASV'
  | 'DARBY'
  | 'RLT'
  | 'RWEBSTER'
  | 'RV1895'
export type StrongBibleDatasetId =
  | 'LSG'
  | 'DBY'
  | 'DBYR'
  | 'KJV'
  | 'NASB2020'
  | 'NASB1995'
  | 'BSB'
  | 'ASV'
  | 'DARBY_EN'
  | 'RLT'
  | 'RWEBSTER'
  | 'RV1895'

export const FRENCH_STRONG_BIBLE_PRIORITY = ['LSG', 'DBY', 'DBR'] as const
export const ENGLISH_STRONG_BIBLE_PRIORITY = [
  'KJV',
  'NASB2020',
  'NASB1995',
  'BSB',
  'ASV',
  'DARBY',
  'RLT',
  'RWEBSTER',
  'RV1895',
] as const
export const STRONG_BIBLE_FALLBACK_PRIORITY = [
  ...FRENCH_STRONG_BIBLE_PRIORITY,
  ...ENGLISH_STRONG_BIBLE_PRIORITY,
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
  sourceVersion: string
  sourceSha256: string
  canonical: PublicationArtifact & {
    verseCount: number
    noteCount: number
    headingCount?: number
  }
  strong: PublicationArtifact & {
    strongRevision: string
    verseCount: number
    occurrenceCount: number
    unalignedOccurrenceCount: number
    identityCount: number
    lexemeAssignmentCount: number
    lexemeCount: number
    reverseInterlinearSchemaVersion?: number
    reverseInterlinearStepRevision?: string
    reverseInterlinearStepTextSha256?: string
    reverseInterlinearCompatibleRuntimeSha256s?: string[]
  }
}

type EnglishPublicationInput = {
  id: Exclude<StrongBibleVersionId, 'LSG' | 'DBY' | 'DBR'>
  datasetId: StrongBibleDatasetId
  sourceVersion: string
  sourceSha256: string
  canonical: [
    archiveSha256: string,
    archiveBytes: number,
    contentSha256: string,
    contentBytes: number,
    textRevision: string,
    textSha256: string,
    verseCount: number,
    noteCount: number,
    headingCount: number,
  ]
  strong: [
    archiveSha256: string,
    archiveBytes: number,
    contentSha256: string,
    contentBytes: number,
    strongRevision: string,
    occurrenceCount: number,
    unalignedOccurrenceCount: number,
    identityCount: number,
    lexemeAssignmentCount: number,
    lexemeCount: number,
  ]
}

const makeEnglishPublication = ({
  id,
  datasetId,
  sourceVersion,
  sourceSha256,
  canonical,
  strong,
}: EnglishPublicationInput): StrongBiblePublication => {
  const fileId = id.toLocaleLowerCase()
  const [
    canonicalArchiveSha256,
    canonicalArchiveBytes,
    canonicalContentSha256,
    canonicalContentBytes,
    textRevision,
    textSha256,
    verseCount,
    noteCount,
    headingCount,
  ] = canonical
  const [
    strongArchiveSha256,
    strongArchiveBytes,
    strongContentSha256,
    strongContentBytes,
    strongRevision,
    occurrenceCount,
    unalignedOccurrenceCount,
    identityCount,
    lexemeAssignmentCount,
    lexemeCount,
  ] = strong

  return {
    applicationVersionId: id,
    datasetId,
    sourceVersion,
    sourceSha256,
    canonical: {
      url: cdnUrl(`bibles/bible-${fileId}.json.zip?v=${canonicalArchiveSha256.slice(0, 12)}`),
      entry: `bible-${fileId}.json`,
      archiveSha256: canonicalArchiveSha256,
      archiveBytes: canonicalArchiveBytes,
      contentSha256: canonicalContentSha256,
      contentBytes: canonicalContentBytes,
      textRevision,
      textSha256,
      schemaVersion: 4,
      verseCount,
      noteCount,
      headingCount,
    },
    strong: {
      url: cdnUrl(`bibles/bible-${fileId}-strong.sqlite.zip?v=${strongArchiveSha256.slice(0, 12)}`),
      entry: `bible-${fileId}-strong.sqlite`,
      archiveSha256: strongArchiveSha256,
      archiveBytes: strongArchiveBytes,
      contentSha256: strongContentSha256,
      contentBytes: strongContentBytes,
      textRevision,
      textSha256,
      schemaVersion: 2,
      strongRevision,
      verseCount,
      occurrenceCount,
      unalignedOccurrenceCount,
      identityCount,
      lexemeAssignmentCount,
      lexemeCount,
    },
  }
}

const BASE_STRONG_BIBLE_PUBLICATIONS: Record<StrongBibleVersionId, StrongBiblePublication> = {
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
  KJV: makeEnglishPublication({
    id: 'KJV',
    datasetId: 'KJV',
    sourceVersion: 'KJV',
    sourceSha256: '1cf89163b1409a07dcab66a58008d434552d24e384f8565cacb50900a9d3cd1d',
    canonical: [
      '90e26238f3157305a44441fdc824dfe19698da3478bcaa1eba29d4f786acda15',
      1968291,
      'fe928186c38d2385bdabe3937a9a35e1ef26f1d9c99a142bb59b82fbe36b1ac8',
      12459817,
      'kjv-ad56e9a05eb5d0c7c680',
      'ad56e9a05eb5d0c7c680ffd9b12647304a3dc86f22529a59b4027832174685c3',
      31102,
      6959,
      138,
    ],
    strong: [
      'd4d5dd2bf99609f786890c9629550bd38605113417abcdd7480e5ccc1eed2a41',
      7814523,
      'd13cc4d514f5c325a1925531408142bc4fcaa6062589c3300303fd472ad2d510',
      18628608,
      'cbb0703e8bb9818733f522c9e9b22c05d9c7ba07a7ad306a079b9303f7f0d760',
      355426,
      6331,
      373413,
      349095,
      12059,
    ],
  }),
  NASB2020: makeEnglishPublication({
    id: 'NASB2020',
    datasetId: 'NASB2020',
    sourceVersion: 'NASB',
    sourceSha256: '356e2fa24e094faa2355e944288fe2cc80c4b32fdfe0feda4663880d8f23289f',
    canonical: [
      'fd31bf3b568b4ee754275d3483c69205f68dca9764887d8fcfc2b114dade019b',
      4028376,
      '77618f87c51bed257d90180edb987dad121ae4b06df09607c55e1f3ef774d7ed',
      29500427,
      'nasb2020-65ace237d852ddd27204',
      '65ace237d852ddd27204083b5811bfd8ec5521c4f7cd894972a2a392113e0a27',
      31102,
      61635,
      2411,
    ],
    strong: [
      '87fdd1c186b069c10d152c6ec8c6a2a4eb809f961c1e70978d2cf59ebe644868',
      8155949,
      '859be4ea16eeb814d8546dbac078283dbbf8d6fa48bc195691c94ce0d7e6a0e6',
      18984960,
      '766602bf6a8593648c470fc27a609032f247cab4de65b9e16f6a18e1d13c2459',
      368539,
      3,
      375260,
      368536,
      12728,
    ],
  }),
  NASB1995: makeEnglishPublication({
    id: 'NASB1995',
    datasetId: 'NASB1995',
    sourceVersion: 'NASB1995',
    sourceSha256: '3d5394da89134f08f862c5475f24b6f040631ecc2f2885ce61f3d27547ab96c2',
    canonical: [
      'e97d94156048860e0f77c87c22f58a8654fc4b6bb43f18f84ffc13f93603ca62',
      3941192,
      '4e25ff2603cb0777c13c2aae20b723db3279818c62d4d936f5b06966cfc7e747',
      28865428,
      'nasb1995-94ac05be2c39e898e8eb',
      '94ac05be2c39e898e8eb8fc1eea552ab6fb87b314a5deb4c9e8b44238d5bf248',
      31102,
      61296,
      2371,
    ],
    strong: [
      '06041909d412b3ff827a787dee853c8433da1fac269f27594f3ed8120a7e6018',
      7861577,
      'e5a2c08c84d55011c4d5d128f2dfead59beed6d57bd742e76db4abbda7af952b',
      18186240,
      '0d5494bcf06492efce3260572b3a3857b17a64ece516ed073841f2fec18a11f8',
      351930,
      1,
      358103,
      351929,
      13020,
    ],
  }),
  BSB: makeEnglishPublication({
    id: 'BSB',
    datasetId: 'BSB',
    sourceVersion: 'BSB',
    sourceSha256: 'aa20cda3c4bb4dd517626281670b525f56a2154f55254f710f92018a7e3ce677',
    canonical: [
      '7c9de2aded54e67be57b355595ae5a988639eb21ce3bc2700004647df2a28e6b',
      2368762,
      'bbaa3f0519660738557f6f8a8bc930df4b7395309d3cc7df561f7707068d2bc8',
      14459769,
      'bsb-64705565357e807a011e',
      '64705565357e807a011e28cc6f179545e4c638c4f264c4cfc4ac7dbf15459612',
      31102,
      4817,
      3375,
    ],
    strong: [
      '5a59d2ba727d0cc128fb1430ea0052dbdb4ee9b212fec1bad36ea1abd2e08f3b',
      9070478,
      'a775f12d016d686949311108e052541e2833c68c85b03771a2b8e9e3f62d421c',
      21262336,
      '34a6897d354fb63e163003b55dece5fd5ae70d83ca74f2a34f27aa48c78e1ffd',
      412259,
      34857,
      435307,
      377402,
      12794,
    ],
  }),
  ASV: makeEnglishPublication({
    id: 'ASV',
    datasetId: 'ASV',
    sourceVersion: 'ASV',
    sourceSha256: '054f48b4f7b925be4f62d7ecb5af16964c659eb386663b761f720eba14ecc048',
    canonical: [
      '502ecbe1c8dd701bb296fd60022964fc5ad3e9b894f37f33d4347a1a0b26d0ce',
      1723130,
      '2d228b4a8b3560c5e1e542afed21ab015ac3f55ae387b58033ee16b793a03b96',
      9768444,
      'asv-0ac0088ab30e04cb00d0',
      '0ac0088ab30e04cb00d04016fdd8c3802090a1067252866fa7c6889d5b5a8fe6',
      31102,
      16,
      121,
    ],
    strong: [
      'ec3f4b067ed98c027884f8144efccdd9935be4e627443303bf33e4ad0f4dc966',
      12982374,
      '2fedffb1d8c9279cfd9f68a62f31d0dcec3963fb884f502c8269ece48e3aef8d',
      32784384,
      'e004189802acc8a15c95107e94dcd3515471e65121955b4cf933231b68bd9f41',
      681149,
      0,
      681149,
      681149,
      8895,
    ],
  }),
  DARBY: makeEnglishPublication({
    id: 'DARBY',
    datasetId: 'DARBY_EN',
    sourceVersion: 'Darby',
    sourceSha256: '5a98bc67ae914ef7a662602a10b890362aead3f7f0f51f64dbbf00e9f943cf8a',
    canonical: [
      '6673e4f8af08145eae883895535912a287217a4570a0fa53a0a170bfc6b18f4a',
      1513867,
      'c1b61032533f18c088c97dfbb6b35d0d236ae854037f0adbec2d15b65a42fe99',
      7548450,
      'darby-c154ea76fe98519f61ad',
      'c154ea76fe98519f61ad993a51c31f974ab41df380e398cf8e8620ff5e61be0a',
      31102,
      4296,
      116,
    ],
    strong: [
      'ca8346d6bc6bc777e4f5207ff52c44d1c7aedf9f16680e2ce31a07306e7761fa',
      12801457,
      'b984f0a511161e6a70886a53983ffa639cc4c5b71d4f3b312c53869f184ef74a',
      32649216,
      '0590d5123167add644ed5ed4f7124e4ceefa405c5941849562ac9289b07c60df',
      679619,
      0,
      679619,
      679619,
      8365,
    ],
  }),
  RLT: makeEnglishPublication({
    id: 'RLT',
    datasetId: 'RLT',
    sourceVersion: 'RLT',
    sourceSha256: 'e40661ff1a63f280d161bb214a2056daca74446b037e3bdce6aa45428396c8e9',
    canonical: [
      '978dee213175e90ebbab340ddf806029b109e72b63d9804148cafec18eb6c1ed',
      1980897,
      '9a6b872d7b5f1bf9740425ed1c1f229516cd919346fe1c15c5afc79bd3ca178d',
      12724834,
      'rlt-a3027fd8c7999a02185d',
      'a3027fd8c7999a02185dbce1640a581ae146f5cde73f63169c44eed3930a9b0e',
      31102,
      6899,
      138,
    ],
    strong: [
      'f8b755e54b2cf9c79795433f855f29e48ea1517093562fcb4126a380b28a29dc',
      7814196,
      'ea77391466100f5d3b2a14e9b65498913d98a878e7a0f9a634b3b1bc343b6313',
      18628608,
      'a9a1010a29763e0966da1b8a71a17efacd6d8dac03b247a85ee8d8f3a4823691',
      355420,
      6330,
      373406,
      349090,
      11993,
    ],
  }),
  RWEBSTER: makeEnglishPublication({
    id: 'RWEBSTER',
    datasetId: 'RWEBSTER',
    sourceVersion: 'RWebster',
    sourceSha256: '7ba3bd69f77202b86098f0c33950a2d6c73894a148382a9df68003c982ca41fa',
    canonical: [
      '868dc0d6b7f733b95291921d27ec168277373a63c717936e3e2d38109cb9217f',
      1885171,
      '182cd439738c46600f8701ba61e75b326ec155efbca24e0607f346c5d1c9d336',
      11148277,
      'rwebster-ca0e35e6107b68df4fec',
      'ca0e35e6107b68df4fec08712fb0b7445397bdafa6aa6501ff5f505d48abcd98',
      31102,
      7881,
      137,
    ],
    strong: [
      'a048f173041ac000b6503e8cc73bb62243598933e34803b765472bf13518e6f2',
      7466135,
      '996b8405ac667716d681177cdf57311b9cd247ccb7e6d4fb4fa7da9ddfd57dc4',
      17891328,
      'eccd73f425b5129d447a1644a69a87eab84c2f299c68565d7980cfde485bf518',
      347013,
      468,
      350877,
      346545,
      11294,
    ],
  }),
  RV1895: makeEnglishPublication({
    id: 'RV1895',
    datasetId: 'RV1895',
    sourceVersion: 'RV_th',
    sourceSha256: '2461b22bdf9458eff8c3397b193115674841869c362fb891d52f4a0e31268c78',
    canonical: [
      '1c086b73cf7945eae5523d6d1931eda27c4250f9059f57731532fa8927d13dbb',
      1526765,
      '10f3703f69e87879946db7779fcd1a7ac8db1a51593c3a7eed3079e8ca279d19',
      7884754,
      'rv1895-d5ba1145525adcde5dc3',
      'd5ba1145525adcde5dc3de20edf068c9e5ff3496fd86b3d383813d222f1bb7e3',
      31104,
      16,
      139,
    ],
    strong: [
      '846556663d0fef663d37d581f45e8bd4ed7143a46ab1396e61cf17d7440786c8',
      8050457,
      'fdd8b1171b737b8d3fd49693f736ddbe938ec41797d36925e9471a93e15a3f4a',
      20074496,
      '1a28d52876df77240af6b1c816392d7b40171dbcb511be3fa8f2d3d89c24aa13',
      401886,
      0,
      401886,
      401886,
      8121,
    ],
  }),
}

export const STRONG_BIBLE_PUBLICATIONS = Object.fromEntries(
  Object.entries(BASE_STRONG_BIBLE_PUBLICATIONS).map(([versionId, publication]) => {
    const candidate =
      STRONG_BIBLE_REVERSE_INTERLINEAR_CANDIDATES[
        versionId as keyof typeof STRONG_BIBLE_REVERSE_INTERLINEAR_CANDIDATES
      ]
    const fileId = versionId.toLocaleLowerCase()
    const canonical = candidate.canonical
    const strong = candidate.strong
    return [
      versionId,
      {
        ...publication,
        canonical: {
          ...publication.canonical,
          url: cdnUrl(`bibles/bible-${fileId}.json.zip?v=${canonical[0].slice(0, 12)}`),
          archiveSha256: canonical[0],
          archiveBytes: canonical[1],
          contentSha256: canonical[2],
          contentBytes: canonical[3],
          textRevision: canonical[4],
          textSha256: canonical[5],
          schemaVersion: canonical[6],
          verseCount: canonical[7],
          noteCount: canonical[8],
          headingCount: canonical[9],
        },
        strong: {
          ...publication.strong,
          url: cdnUrl(`bibles/bible-${fileId}-strong.sqlite.zip?v=${strong[0].slice(0, 12)}`),
          archiveSha256: strong[0],
          archiveBytes: strong[1],
          contentSha256: strong[2],
          contentBytes: strong[3],
          textRevision: canonical[4],
          textSha256: canonical[5],
          strongRevision: strong[4],
          schemaVersion: strong[5],
          verseCount: canonical[7],
          occurrenceCount: strong[6],
          unalignedOccurrenceCount: strong[7],
          identityCount: strong[8],
          lexemeAssignmentCount: strong[9],
          lexemeCount: strong[10],
          reverseInterlinearSchemaVersion: REVERSE_INTERLINEAR_STEP_CONTRACT.schemaVersion,
          reverseInterlinearStepRevision: REVERSE_INTERLINEAR_STEP_CONTRACT.stepRevision,
          reverseInterlinearStepTextSha256: REVERSE_INTERLINEAR_STEP_CONTRACT.stepTextSha256,
          reverseInterlinearCompatibleRuntimeSha256s: [
            ...REVERSE_INTERLINEAR_STEP_CONTRACT.compatibleRuntimeSha256s,
          ],
        },
      },
    ]
  })
) as Record<StrongBibleVersionId, StrongBiblePublication>

export const isStrongCapableBibleVersion = (versionId: string): versionId is StrongBibleVersionId =>
  versionId in STRONG_BIBLE_PUBLICATIONS

export const getStrongBiblePublication = (
  versionId: StrongBibleVersionId
): StrongBiblePublication => STRONG_BIBLE_PUBLICATIONS[versionId]

export const usesCanonicalBibleExtras = (versionId: string): boolean =>
  isStrongCapableBibleVersion(versionId) &&
  STRONG_BIBLE_PUBLICATIONS[versionId].canonical.schemaVersion >= 4

export const getStrongBibleAttributionKey = (
  versionId: StrongBibleVersionId
): 'versionSelector.strongAttribution' | 'versionSelector.strongAttributionEnglishSources' =>
  ENGLISH_STRONG_BIBLE_PRIORITY.includes(
    versionId as (typeof ENGLISH_STRONG_BIBLE_PRIORITY)[number]
  )
    ? 'versionSelector.strongAttributionEnglishSources'
    : 'versionSelector.strongAttribution'

const ENGLISH_BIBLE_VERSION_IDS = new Set([
  ...ENGLISH_STRONG_BIBLE_PRIORITY,
  'INT_EN',
  'NKJV',
  'ESV',
  'NIV',
  'EASY',
  'TLV',
  'NET',
  'GW',
  'CSB',
  'NLT',
  'AMP',
])

export const getStrongBibleFallbackPriority = (
  bibleVersionId: string
): readonly StrongBibleVersionId[] =>
  ENGLISH_BIBLE_VERSION_IDS.has(bibleVersionId)
    ? ENGLISH_STRONG_BIBLE_PRIORITY
    : FRENCH_STRONG_BIBLE_PRIORITY

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
  if (versionId === 'KJVS') {
    return { versionId: 'KJV', strongMode: 'visible' }
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
