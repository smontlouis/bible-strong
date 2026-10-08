/* eslint-disable import/first */

jest.mock('~helpers/offlineCopy', () => ({
  createOfflineCopyId: ({ kind, versionId }: { kind: string; versionId: string }) =>
    `${kind}:${versionId}`,
}))

jest.mock('~helpers/strongBiblePublications', () => ({
  isStrongCapableBibleVersion: (versionId: string) => versionId === 'LSG',
  getStrongBibleAttributionKey: () => 'versionSelector.strongAttribution',
  getStrongDatasetId: () => 'LSG',
}))

const mockCreateBibleDownloadItem = jest.fn((_versionId: string) => ({ estimatedSize: 42 }))
jest.mock('~helpers/downloadItemFactory', () => ({
  createBibleDownloadItem: (versionId: string) => mockCreateBibleDownloadItem(versionId),
  createInterlinearSidecarDownloadItem: (language: string) => ({
    estimatedSize: language === 'fr' ? 2200 : 2300,
  }),
  createStrongSidecarDownloadItem: () => ({ estimatedSize: 1300 }),
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

  it('sizes BHG indexes and Strong indexes from the catalog the application holds', () => {
    const base = { type: 'other', language: 'other', readingProfile: null } as const
    const bhg = { ...base, id: 'BHG', name: 'Bible hébraïque et grecque' } as unknown as Version
    const lsg = { ...base, id: 'LSG', name: 'Louis Segond', type: 'fr' } as unknown as Version

    const items = buildBibleItems([bhg, lsg], 'fr', translate)

    // No size is compiled into the application: a republished index shows its real size.
    expect(items.map(item => item.estimatedSize)).toEqual([42, 2200, 2300, 42, 1300])
    expect(items[1]?.parentItemId).toBe(items[0]?.id)
    expect(items[4]?.parentItemId).toBe(items[3]?.id)
  })
})
