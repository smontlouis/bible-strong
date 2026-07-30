/* eslint-disable import/first */

jest.mock('../bibleVersions', () => ({
  versions: {
    DBY: { id: 'DBY' },
    BHG: { id: 'BHG' },
  },
}))

jest.mock('../strongBiblePublications', () => ({
  isStrongCapableBibleVersion: (versionId: string) => versionId === 'DBY',
}))

jest.mock('../databaseTypes', () => ({
  LANGUAGE_SPECIFIC_DBS: ['NAVE'],
  SHARED_DBS: ['BIBLES'],
}))

import {
  createOfflineCopyId,
  getOfflineCopyInvalidationKeys,
  parseOfflineCopyId,
  type OfflineCopyIdentity,
} from '../offlineCopy'

describe('Offline copy identity', () => {
  const identities: OfflineCopyIdentity[] = [
    { kind: 'bible', versionId: 'DBY' },
    { kind: 'strong-bible-index', versionId: 'DBY' },
    { kind: 'interlinear-index', versionId: 'BHG', language: 'fr' },
    { kind: 'strong-lexicon-module', moduleId: 'resources' },
    { kind: 'database', databaseId: 'NAVE', language: 'en' },
    { kind: 'bible-pericope', versionId: 'DBY' },
    { kind: 'bible-red-words', versionId: 'DBY' },
  ]

  it.each(identities)('round-trips $kind identities through their canonical id', identity => {
    const id = createOfflineCopyId(identity)

    expect(parseOfflineCopyId(id)).toEqual(identity)
  })

  it.each([
    'bible:',
    'bible-strong:UNKNOWN',
    'bible-interlinear:OTHER:fr',
    'bible-interlinear:BHG:de',
    'strong-lexicon:unknown',
    'database:BIBLES:fr',
    'database:NAVE:de',
    'anything:else',
  ])('rejects malformed or unsupported id %s', id => {
    expect(parseOfflineCopyId(id)).toBeUndefined()
  })

  it('declares the query invalidations produced by a Strong lexicon mutation', () => {
    expect(
      getOfflineCopyInvalidationKeys({
        kind: 'strong-lexicon-module',
        moduleId: 'core',
      })
    ).toEqual([
      ['strong-lexicon'],
      ['strong-lexicon-entry'],
      ['strong-detail'],
      ['home-strong-random'],
      ['sqlite-strong-search'],
      ['relation-strong-targets'],
      ['resource-publication', 'strong-lexicon:core'],
    ])
  })

  it('declares Bible and publication invalidations for a Bible mutation', () => {
    expect(getOfflineCopyInvalidationKeys({ kind: 'bible', versionId: 'DBY' })).toEqual([
      ['bible'],
      ['strong-detail'],
      ['bible-version-coverage', 'DBY'],
      ['downloaded-bible-version-ids'],
      ['strong-mode-availability', 'DBY'],
      ['resource-publication', 'bible:DBY'],
    ])
  })

  it('invalidates Strong detail data when a Strong Bible index changes', () => {
    expect(
      getOfflineCopyInvalidationKeys({ kind: 'strong-bible-index', versionId: 'DBY' })
    ).toEqual([
      ['bible'],
      ['strong-detail'],
      ['strong-index-availability', 'DBY'],
      ['strong-mode-availability', 'DBY'],
      ['resource-publication', 'bible-strong:DBY'],
    ])
  })

  it('declares the domain invalidations produced by a resource database mutation', () => {
    expect(
      getOfflineCopyInvalidationKeys({
        kind: 'database',
        databaseId: 'NAVE',
        language: 'en',
      })
    ).toEqual(
      expect.arrayContaining([
        ['resource-database', 'NAVE', 'en'],
        ['nave'],
        ['nave-detail'],
        ['home-nave-random'],
        ['sqlite-nave-search'],
        ['relation-nave-targets'],
        ['resource-publication', 'database:NAVE:en'],
      ])
    )
  })
})
