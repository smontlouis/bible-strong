import {
  migrateLegacyBibleTabData,
  migrateLegacyDownloadQueue,
  migrateLegacyParallelVersions,
} from '../legacyBibleVersionMigration'

describe('legacy Bible version migration', () => {
  it.each([
    [
      'LSGS',
      {
        selectedVersion: 'LSG',
        strongMode: 'hidden',
        pendingModeAcquisition: {
          kind: 'strong',
          versionId: 'LSG',
          mode: 'visible',
          planIds: ['bible-strong:LSG'],
        },
      },
    ],
    [
      'KJVS',
      {
        selectedVersion: 'KJV',
        strongMode: 'hidden',
        pendingModeAcquisition: {
          kind: 'strong',
          versionId: 'KJV',
          mode: 'visible',
          planIds: ['bible-strong:KJV'],
        },
      },
    ],
    [
      'INT',
      {
        selectedVersion: 'BHG',
        interlinearMode: 'hidden',
        interlinearLocale: 'fr',
        pendingModeAcquisition: {
          kind: 'interlinear',
          mode: 'interlinear',
          locale: 'fr',
          planIds: ['bible-interlinear:BHG:fr'],
        },
      },
    ],
    [
      'INT_EN',
      {
        selectedVersion: 'BHG',
        interlinearMode: 'hidden',
        interlinearLocale: 'en',
        pendingModeAcquisition: {
          kind: 'interlinear',
          mode: 'interlinear',
          locale: 'en',
          planIds: ['bible-interlinear:BHG:en'],
        },
      },
    ],
  ])('maps the persisted %s identity to its canonical resource', (selectedVersion, expected) => {
    expect(
      migrateLegacyBibleTabData({
        selectedVersion,
        strongMode: 'hidden',
        interlinearMode: 'interlinear',
        parallelVersions: [],
      })
    ).toMatchObject(expected)
  })

  it('deduplicates canonical parallel versions and removes the selected Bible', () => {
    expect(migrateLegacyParallelVersions(['LSGS', 'INT', 'INT_EN', 'KJVS', 'LSG'], 'LSG')).toEqual([
      'BHG',
      'KJV',
    ])
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
