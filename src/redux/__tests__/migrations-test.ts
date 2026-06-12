import migrations from '../migrations'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
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
})
