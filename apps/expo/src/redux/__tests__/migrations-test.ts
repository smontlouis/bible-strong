import migrations from '../migrations'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  getLanguage: () => 'fr',
  t: (key: string) => key,
}))

jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

describe('redux migrations', () => {
  const createLegacyState = () =>
    ({
      user: {
        bible: {
          notes: {
            '1-1-1': { title: 'Legacy note', description: 'Body', date: 1 },
          },
          links: {},
          wordAnnotations: {},
          relations: {
            valid: {
              id: 'valid',
              endpoints: [
                { type: 'verse', verseKeys: ['1-1-1'] },
                { type: 'verse', verseKeys: ['1-1-2'] },
              ],
              type: 'linked',
              direction: 'none',
              createdAt: 1,
              updatedAt: 1,
            },
            invalid: {
              id: 'invalid',
              endpoints: [{ type: 'note' }, { type: 'verse', verseKeys: ['1-1-3'] }],
              type: 'linked',
              direction: 'none',
              createdAt: 1,
              updatedAt: 1,
            },
          },
        },
      },
    }) as never

  it('skips invalid legacy relations without aborting the relation migration', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const migrated = migrations[33](createLegacyState())

    expect(migrated.user.bible.relations.valid).toMatchObject({
      id: 'valid',
      endpointKeys: ['verse:1-1-1', 'verse:1-1-2'],
    })
    expect(migrated.user.bible.relations.invalid).toBeUndefined()
    expect(Object.values(migrated.user.bible.relations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'system',
          type: 'annotates',
          endpointKeys: ['note:1-1-1', 'verse:1-1-1'],
        }),
      ])
    )
    expect(Object.keys(migrated.user.bible.relationIndex)).toEqual(
      expect.arrayContaining(['verse:1-1-1', 'verse:1-1-2', 'note:1-1-1'])
    )
    expect(warnSpy).toHaveBeenCalledWith(
      '[ReduxMigration] Skipping invalid relation during migration',
      expect.objectContaining({ relationId: 'invalid' })
    )

    warnSpy.mockRestore()
  })

  it('migrates removed Bible identities from persisted user settings and records', () => {
    const state = createLegacyState() as any
    state.user.bible.settings = {
      defaultBibleVersion: 'KJVS',
      defaultStrongBibleVersionId: 'LSGS',
      compare: { LSGS: true, INT_EN: true },
    }
    state.user.bible.bookmarks = { bookmark: { version: 'KJVS' } }
    state.user.bible.highlights = { '1-1-1': { version: 'LSGS' } }
    state.user.bible.links = {
      '1-1-2': {
        url: 'https://example.com',
        linkType: 'website',
        date: 1,
        version: 'KJVS',
      },
    }
    state.user.bible.wordAnnotations = { annotation: { version: 'INT' } }
    state.user.bible.relations = {
      manual: {
        id: 'manual',
        kind: 'manual',
        endpoints: [
          { type: 'verse', verseKeys: ['1-1-1'], version: 'LSGS' },
          { type: 'verse', verseKeys: ['1-1-2'], version: 'INT_EN' },
        ],
        endpointKeys: ['verse:1-1-1', 'verse:1-1-2'],
        endpointTypes: ['verse', 'verse'],
        pairKey: 'verse:1-1-1::verse:1-1-2',
        duplicateKey: 'linked:none:verse:1-1-1::verse:1-1-2',
        type: 'linked',
        direction: 'none',
        createdAt: 1,
        updatedAt: 1,
      },
    }

    const migrated = migrations[36](state)

    expect(migrated.user.bible.settings).toMatchObject({
      defaultBibleVersion: 'KJV',
      defaultStrongBibleVersionId: 'LSG',
      compare: { LSG: true, BHG: true },
    })
    expect(migrated.user.bible.bookmarks.bookmark.version).toBe('KJV')
    expect(migrated.user.bible.highlights['1-1-1'].version).toBe('LSG')
    expect(migrated.user.bible.links['1-1-2'].version).toBe('KJV')
    expect(migrated.user.bible.wordAnnotations.annotation.version).toBe('BHG')
    expect(migrated.user.bible.relations.manual.endpoints).toEqual([
      expect.objectContaining({ type: 'verse', version: 'LSG' }),
      expect.objectContaining({ type: 'verse', version: 'BHG' }),
    ])
    expect(Object.values(migrated.user.bible.relations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'system',
          type: 'externalLink',
          endpoints: expect.arrayContaining([
            expect.objectContaining({ type: 'verse', version: 'KJV' }),
          ]),
        }),
      ])
    )
    expect(migrated.user.bible.relationIndex['verse:1-1-2']).toBeDefined()
  })

  it('clears comparison versions that predate explicit comparison selection', () => {
    const state = createLegacyState() as any
    state.user.bible.settings = {
      compare: { LSG: true, KJV: true, NASB2020: true },
    }

    const migrated = migrations[37](state)

    expect(migrated.user.bible.settings.compare).toEqual({})
    expect(migrated.user.bible.settings.compareSelectionVersion).toBe(2)
  })

  it('normalizes the commentary preference stored in synced user settings', () => {
    const state = createLegacyState() as any
    state.user.bible.settings = {
      commentarySelection: ['acbc:fr', 'invalid', 'barnes:fr', 'acbc:fr'],
    }

    const migrated = migrations[38](state)

    expect(migrated.user.bible.settings.commentarySelection).toEqual(['acbc:fr', 'barnes:fr'])
  })
})
