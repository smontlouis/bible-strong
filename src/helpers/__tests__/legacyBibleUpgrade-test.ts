/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  deleteAsync: jest.fn(),
}))

jest.mock('../storage', () => ({
  storage: {
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

import * as FileSystem from 'expo-file-system/legacy'

import { cleanupLegacyBibleResources } from '../legacyBibleUpgrade'
import {
  migrateLegacyBibleTabData,
  migrateLegacyDownloadQueue,
  migrateLegacyParallelVersions,
  preserveLegacyDownloadsInQueue,
} from '../legacyBibleVersionMigration'

const mockDeleteAsync = jest.mocked(FileSystem.deleteAsync)

describe('legacyBibleUpgrade', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeleteAsync.mockResolvedValue()
  })

  it.each([
    [
      'LSGS',
      {
        selectedVersion: 'LSG',
        strongMode: 'visible',
      },
    ],
    [
      'KJVS',
      {
        selectedVersion: 'KJV',
        strongMode: 'visible',
      },
    ],
    [
      'INT',
      {
        selectedVersion: 'BHG',
        interlinearMode: 'hidden',
        interlinearLocale: 'fr',
      },
    ],
    [
      'INT_EN',
      {
        selectedVersion: 'BHG',
        interlinearMode: 'hidden',
        interlinearLocale: 'en',
      },
    ],
  ])('migrates a persisted %s Bible tab', (selectedVersion, expected) => {
    expect(
      migrateLegacyBibleTabData({
        selectedVersion,
        strongMode: 'hidden',
        interlinearMode: 'interlinear',
        parallelVersions: [],
      })
    ).toMatchObject(expected)
  })

  it('migrates, deduplicates and removes the selected Bible from parallel versions', () => {
    expect(migrateLegacyParallelVersions(['LSGS', 'INT', 'INT_EN', 'KJVS', 'LSG'], 'LSG')).toEqual([
      'BHG',
      'KJV',
    ])
  })

  it('removes obsolete downloads from the persisted queue', () => {
    expect(
      migrateLegacyDownloadQueue(
        JSON.stringify([
          { item: { id: 'bible:LSGS', versionId: 'LSGS' }, status: 'queued' },
          { item: { id: 'bible:KJV', versionId: 'KJV' }, status: 'queued' },
          { item: { id: 'bible:INT_EN', versionId: 'INT_EN' }, status: 'failed' },
          {
            item: { id: 'database:STRONG:fr', databaseId: 'STRONG', lang: 'fr' },
            status: 'queued',
          },
          {
            item: {
              id: 'database:INTERLINEAIRE:en',
              databaseId: 'INTERLINEAIRE',
              lang: 'en',
            },
            status: 'failed',
          },
        ])
      )
    ).toBe(JSON.stringify([{ item: { id: 'bible:KJV', versionId: 'KJV' }, status: 'queued' }]))
  })

  it('preserves obsolete downloads when the active download queue is persisted', () => {
    const existingQueue = JSON.stringify([
      { item: { id: 'bible:LSGS', versionId: 'LSGS' }, status: 'queued' },
      {
        item: { id: 'database:STRONG:fr', databaseId: 'STRONG', lang: 'fr' },
        status: 'failed',
      },
      { item: { id: 'bible:KJV', versionId: 'KJV' }, status: 'queued' },
    ])
    const activeQueue = JSON.stringify([
      { item: { id: 'bible:BHG', versionId: 'BHG' }, status: 'failed' },
    ])

    expect(preserveLegacyDownloadsInQueue(existingQueue, activeQueue)).toBe(
      JSON.stringify([
        { item: { id: 'bible:LSGS', versionId: 'LSGS' }, status: 'queued' },
        {
          item: { id: 'database:STRONG:fr', databaseId: 'STRONG', lang: 'fr' },
          status: 'failed',
        },
        { item: { id: 'bible:BHG', versionId: 'BHG' }, status: 'failed' },
      ])
    )
  })

  it('deletes obsolete Bible files and both legacy interlinear databases once', async () => {
    const values = new Map<string, string | boolean>([
      [
        'downloadQueue',
        JSON.stringify([
          { item: { id: 'bible:LSGS', versionId: 'LSGS' }, status: 'queued' },
          { item: { id: 'bible:LSG', versionId: 'LSG' }, status: 'queued' },
        ]),
      ],
    ])
    const backend = {
      getBoolean: (key: string) => values.get(key) as boolean | undefined,
      getString: (key: string) => values.get(key) as string | undefined,
      set: jest.fn((key: string, value: string | boolean) => values.set(key, value)),
      remove: jest.fn((key: string) => values.delete(key)),
    }

    await cleanupLegacyBibleResources({
      terminalOutcome: 'completed',
      storage: backend,
    })

    const deletedPaths = mockDeleteAsync.mock.calls.map(([path]) => path)
    expect(deletedPaths).toEqual(
      expect.arrayContaining([
        'file:///documents/bible-LSGS.json',
        'file:///documents/bible-KJVS.json',
        'file:///documents/SQLite/interlineaire.sqlite',
        'file:///documents/SQLite/fr/interlineaire.sqlite',
        'file:///documents/SQLite/en/interlineaire.sqlite',
        'file:///documents/SQLite/strong.sqlite',
        'file:///documents/SQLite/fr/strong.sqlite',
        'file:///documents/SQLite/en/strong.sqlite',
      ])
    )
    expect(mockDeleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
    expect(values.get('downloadQueue')).toBe(
      JSON.stringify([{ item: { id: 'bible:LSG', versionId: 'LSG' }, status: 'queued' }])
    )
    expect(backend.remove).toHaveBeenCalledWith('resource-publication:bible:LSGS')
    expect(backend.remove).toHaveBeenCalledWith('resource-publication:bible:KJVS')
    expect(values.get('hasCleanedLegacyBibleResourcesV1')).toBe(true)

    mockDeleteAsync.mockClear()
    await cleanupLegacyBibleResources({
      terminalOutcome: 'completed',
      storage: backend,
    })
    expect(mockDeleteAsync).not.toHaveBeenCalled()
  })

  it('preserves obsolete resources until the migration reaches a terminal outcome', async () => {
    const backend = {
      getBoolean: jest.fn(() => undefined),
      getString: jest.fn(() => undefined),
      set: jest.fn(),
      remove: jest.fn(),
    }

    const result = await cleanupLegacyBibleResources({ storage: backend })

    expect(result).toBe('awaiting-terminal-outcome')
    expect(mockDeleteAsync).not.toHaveBeenCalled()
    expect(backend.remove).not.toHaveBeenCalled()
    expect(backend.set).not.toHaveBeenCalled()
  })

  it('does not mark cleanup complete when a deletion fails', async () => {
    mockDeleteAsync.mockRejectedValueOnce(new Error('disk failure'))
    const backend = {
      getBoolean: jest.fn(() => undefined),
      getString: jest.fn(() => undefined),
      set: jest.fn(),
      remove: jest.fn(),
    }

    await expect(
      cleanupLegacyBibleResources({
        terminalOutcome: 'completed',
        storage: backend,
      })
    ).rejects.toThrow('disk failure')
    expect(backend.set).not.toHaveBeenCalledWith('hasCleanedLegacyBibleResourcesV1', true)
  })
})
