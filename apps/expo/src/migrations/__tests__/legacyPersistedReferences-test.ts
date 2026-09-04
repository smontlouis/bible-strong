import {
  canonicalizeLegacySubcollectionData,
  isPersistedCanonicalTabWorkspace,
  migrateLegacyPersistedReferences,
} from '../legacyPersistedReferences'

describe('migrateLegacyPersistedReferences', () => {
  it('canonicalizes incoming legacy references and reports only documents that need write-back', () => {
    expect(
      canonicalizeLegacySubcollectionData({
        legacy: { id: 'legacy', version: 'LSGS', content: 'LSGS stays in authored text' },
        canonical: { id: 'canonical', version: 'LSG' },
      })
    ).toEqual({
      data: {
        legacy: { id: 'legacy', version: 'LSG', content: 'LSGS stays in authored text' },
        canonical: { id: 'canonical', version: 'LSG' },
      },
      changedDocuments: {
        legacy: { id: 'legacy', version: 'LSG', content: 'LSGS stays in authored text' },
      },
    })
  })
  it('recognizes only a non-empty, structurally complete canonical tab workspace', () => {
    expect(isPersistedCanonicalTabWorkspace([])).toBe(false)
    expect(isPersistedCanonicalTabWorkspace([{}])).toBe(false)
    expect(isPersistedCanonicalTabWorkspace([{ id: 'default', tabs: [], activeTabIndex: 0 }])).toBe(
      true
    )
  })

  it('rewrites Redux-persist technical references without changing user-authored text', () => {
    const values = new Map<string, string>([
      [
        'root',
        JSON.stringify({
          user: JSON.stringify({
            bible: {
              settings: {
                defaultBibleVersion: 'KJVS',
                defaultStrongBibleVersionId: 'LSGS',
                compare: { LSGS: true, LSG: false, INT_EN: true },
              },
              bookmarks: { bookmark: { version: 'KJVS' } },
              highlights: { highlight: { version: 'LSGS' } },
              notes: {
                note: { version: 'INT', content: 'KJVS and LSGS are part of my note' },
              },
              wordAnnotations: { annotation: { version: 'INT_EN' } },
              currentTab: {
                selectedVersion: 'LSG',
                strongBibleSourceVersionId: 'KJVS',
              },
            },
          }),
          _persist: JSON.stringify({ version: 36, rehydrated: true }),
        }),
      ],
    ])
    const backend = {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
    }

    migrateLegacyPersistedReferences(backend)

    const root = JSON.parse(values.get('root')!) as Record<string, string>
    const user = JSON.parse(root.user)
    expect(user.bible).toMatchObject({
      settings: {
        defaultBibleVersion: 'KJV',
        defaultStrongBibleVersionId: 'LSG',
        compare: { LSG: true, BHG: true },
      },
      bookmarks: { bookmark: { version: 'KJV' } },
      highlights: { highlight: { version: 'LSG' } },
      notes: {
        note: { version: 'BHG', content: 'KJVS and LSGS are part of my note' },
      },
      wordAnnotations: { annotation: { version: 'BHG' } },
      currentTab: {
        selectedVersion: 'LSG',
        strongBibleSourceVersionId: 'KJV',
      },
    })
    expect(JSON.parse(root._persist)).toEqual({ version: 36, rehydrated: true })
  })

  it('migrates current and historical Jotai tab storage while preserving intended capabilities', () => {
    const values = new Map<string, string>([
      [
        'tabGroupsAtom',
        JSON.stringify([
          {
            tabs: [
              {
                type: 'bible',
                data: {
                  selectedVersion: 'INT_EN',
                  interlinearMode: 'interlinear',
                  parallelVersions: ['LSGS', 'KJVS', 'LSG'],
                },
              },
              {
                type: 'strong',
                data: { strongBibleVersionId: 'LSGS', bibleVersion: 'KJVS' },
              },
            ],
          },
        ]),
      ],
      [
        'tabsAtom',
        JSON.stringify([
          { type: 'bible', data: { selectedVersion: 'LSGS', strongMode: 'visible' } },
        ]),
      ],
      ['savedParallelVersions', JSON.stringify(['INT', 'INT_EN', 'KJVS'])],
    ])
    const backend = {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
    }

    migrateLegacyPersistedReferences(backend)
    migrateLegacyPersistedReferences(backend)

    const groups = JSON.parse(values.get('tabGroupsAtom')!)
    expect(groups[0].tabs[0].data).toMatchObject({
      selectedVersion: 'BHG',
      strongMode: 'hidden',
      interlinearMode: 'hidden',
      interlinearLocale: 'en',
      parallelVersions: ['LSG', 'KJV', 'LSG'],
      pendingModeAcquisition: {
        kind: 'interlinear',
        mode: 'interlinear',
        locale: 'en',
        planIds: ['bible-interlinear:BHG:en'],
      },
    })
    expect(groups[0].tabs[1].data).toEqual({
      strongBibleVersionId: 'LSG',
      bibleVersion: 'KJV',
    })
    expect(JSON.parse(values.get('tabsAtom')!)[0].data).toMatchObject({
      selectedVersion: 'LSG',
      strongMode: 'hidden',
      pendingModeAcquisition: {
        kind: 'strong',
        versionId: 'LSG',
        mode: 'visible',
        planIds: ['bible-strong:LSG'],
      },
    })
    expect(JSON.parse(values.get('savedParallelVersions')!)).toEqual(['BHG', 'BHG', 'KJV'])
  })

  it('leaves malformed and already canonical persisted values untouched', () => {
    const values = new Map<string, string>([
      ['root', '{broken'],
      ['tabGroupsAtom', JSON.stringify([{ data: { selectedVersion: 'LSG' } }])],
    ])
    const set = jest.fn((key: string, value: string) => values.set(key, value))

    migrateLegacyPersistedReferences({
      getString: key => values.get(key),
      set,
    })

    expect(values.get('root')).toBe('{broken')
    expect(set).not.toHaveBeenCalled()
  })
})
