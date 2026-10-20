import {
  migrateLegacyBibleTabData,
  migrateLegacyDownloadQueue,
  migrateLegacyParallelVersions,
} from '../legacyBibleVersionMigration'

describe('legacy Bible version migration', () => {
  it.each([
    ['LSGS', { selectedVersion: 'LSG', strongMode: 'visible', interlinearMode: 'hidden' }],
    ['KJVS', { selectedVersion: 'KJV', strongMode: 'visible', interlinearMode: 'hidden' }],
    [
      'INT',
      {
        selectedVersion: 'BHG',
        strongMode: 'hidden',
        interlinearMode: 'interlinear',
        interlinearLocale: 'fr',
      },
    ],
    [
      'INT_EN',
      {
        selectedVersion: 'BHG',
        strongMode: 'hidden',
        interlinearMode: 'interlinear',
        interlinearLocale: 'en',
      },
    ],
  ])(
    'keeps the presentation of the persisted %s on its canonical resource',
    (selectedVersion, expected) => {
      const migrated = migrateLegacyBibleTabData({
        selectedVersion,
        strongMode: 'hidden',
        interlinearMode: 'hidden',
        parallelVersions: [],
      })
      expect(migrated).toMatchObject(expected)
      expect(migrated).not.toHaveProperty('pendingModeAcquisition')
    }
  )

  it('canonicalizes parallel versions while preserving every occurrence', () => {
    expect(migrateLegacyParallelVersions(['LSGS', 'INT', 'INT_EN', 'KJVS', 'LSG'])).toEqual([
      'LSG',
      'BHG',
      'BHG',
      'KJV',
      'LSG',
    ])
  })

  it('drops a pending mode download left by an earlier version', () => {
    const migrated = migrateLegacyBibleTabData({
      selectedVersion: 'LSG',
      strongMode: 'hidden',
      pendingModeAcquisition: {
        kind: 'strong',
        versionId: 'LSGS',
        mode: 'visible',
        planIds: ['bible:LSGS', 'bible-strong:LSGS'],
      },
    })
    expect(migrated).toMatchObject({ selectedVersion: 'LSG', strongMode: 'hidden' })
    expect(migrated).not.toHaveProperty('pendingModeAcquisition')
  })

  it('removes legacy resources from the queue during final migration cleanup', () => {
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
})
