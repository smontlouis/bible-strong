/* eslint-disable import/first */

jest.mock('~helpers/offlineCopy', () => ({
  createOfflineCopyId: ({ kind, versionId }: { kind: string; versionId: string }) =>
    `${kind}:${versionId}`,
}))

jest.mock('~helpers/strongBiblePublications', () => ({
  isStrongCapableBibleVersion: () => false,
  getStrongBibleAttributionKey: jest.fn(),
  getStrongBiblePublication: jest.fn(),
}))

jest.mock('~helpers/interlinearBiblePublications', () => ({
  BHG_INTERLINEAR_PUBLICATION: {
    canonical: { archiveBytes: 1 },
    indexes: {},
  },
}))

const mockCreateBibleDownloadItem = jest.fn((_versionId: string) => ({ estimatedSize: 42 }))
jest.mock('~helpers/downloadItemFactory', () => ({
  createBibleDownloadItem: (versionId: string) => mockCreateBibleDownloadItem(versionId),
}))

import type { Version } from '~helpers/bibleVersions'
import { buildBibleItems } from '../downloadBibleItems'

const translate = (key: string) => key

describe('buildBibleItems', () => {
  it('keeps bundled pericope and red-word data inside the parent Bible item', () => {
    const version: Version = {
      id: 'NBS',
      name: 'Nouvelle Bible Segond',
      type: 'fr',
      language: 'fr',
      readingProfile: null,
      hasPericope: true,
      hasRedWords: true,
    }

    const items = buildBibleItems([version], 'fr', translate)

    expect(items.map(item => item.id)).toEqual(['bible:NBS'])
    expect(items[0]?.estimatedSize).toBe(42)
  })
})
