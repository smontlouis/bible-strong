/* eslint-disable import/first */

jest.mock('~helpers/databaseTypes', () => ({
  isSharedDB: () => false,
  LANGUAGE_SPECIFIC_DBS: [],
  SHARED_DBS: [],
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: { NBS: { id: 'NBS', name: 'Nouvelle Bible Segond' } },
}))

jest.mock('../downloadItemFactory', () => ({
  createOfflineCopyDownloadItem: () => ({
    id: 'bible:NBS',
    type: 'bible',
    name: 'Nouvelle Bible Segond',
    versionId: 'NBS',
    url: 'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-nbs.json.zip',
    archiveEntry: 'bible-nbs.json',
    archiveEntries: {
      canonical: 'bible-nbs.json',
      pericope: 'bible-nbs-pericope.json',
      redWords: 'red-words-nbs.json',
    },
    estimatedSize: 10,
    addedAt: 999,
    retryCount: 0,
  }),
}))

jest.mock('../strongBiblePublications', () => ({
  isStrongCapableBibleVersion: () => false,
}))

import type { DownloadItem } from '~state/downloadQueue'

import { refreshPersistedDownloadItem } from '../persistedDownloadItem'

describe('persisted download item migration', () => {
  it('rebuilds a legacy Bible queue item from the current bundled catalog', () => {
    const legacyItem = {
      id: 'bible:NBS',
      type: 'bible',
      name: 'NBS',
      versionId: 'NBS',
      url: 'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-nbs.json',
      estimatedSize: 1,
      addedAt: 42,
      retryCount: 1,
    } as DownloadItem

    expect(refreshPersistedDownloadItem(legacyItem)).toEqual(
      expect.objectContaining({
        url: 'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-nbs.json.zip',
        archiveEntries: {
          canonical: 'bible-nbs.json',
          pericope: 'bible-nbs-pericope.json',
          redWords: 'red-words-nbs.json',
        },
        addedAt: 42,
        retryCount: 1,
      })
    )
  })
})
