import {
  createStrongBibleResourceAccess,
  type StrongBibleResourceDependencies,
} from '../strongBibleResourceAccess'

jest.mock('~helpers/biblesDb', () => ({
  getMultipleVerses: jest.fn(),
  getVerseText: jest.fn(),
}))

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

jest.mock('~helpers/strongBibleSidecar', () => ({
  getStrongBibleSidecarAvailability: jest.fn(),
  loadStrongBibleOccurrenceLocations: jest.fn(),
  loadStrongBibleVerseCountsByBook: jest.fn(),
  loadStrongBibleVerseSpans: jest.fn(),
}))

const available = (versionId: 'LSG' | 'DBY' | 'DBR') => ({
  status: 'available' as const,
  versionId,
  datasetId: versionId === 'DBR' ? 'DBYR' : versionId,
  textRevision: `${versionId}-text`,
  strongRevision: `${versionId}-strong`,
})

const createDependencies = (): jest.Mocked<StrongBibleResourceDependencies> => ({
  getAvailability: jest.fn(),
  getVerseText: jest.fn(),
  getVerseSpans: jest.fn(),
  getChapterSpans: jest.fn(),
  getCountsByBook: jest.fn(),
  getResolvedIdentity: jest.fn(),
  getFoundVerseLocations: jest.fn(),
  getLemmaStats: jest.fn(),
  getMultipleVerses: jest.fn(),
})

describe('strongBibleResourceAccess', () => {
  it('keeps Strong spans on a contextual verse so untranslated occurrences remain positionable', async () => {
    const dependencies = createDependencies()
    const spans = [
      {
        ordinal: 0,
        startOffset: 2,
        length: 0,
        identities: [{ kind: 'strong' as const, code: 'H0347' }],
      },
    ]
    dependencies.getAvailability.mockResolvedValue(available('LSG'))
    dependencies.getVerseText.mockResolvedValue('Il prit la parole et dit :')
    dependencies.getVerseSpans.mockResolvedValue(spans)
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'LSG',
      defaultVersionId: 'LSG',
      book: 18,
      chapter: 3,
      verse: 2,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        verse: expect.objectContaining({
          Texte: 'Il prit la parole et dit :',
          StrongSpans: spans,
        }),
      })
    )
  })

  it('uses the current Bible when its compatible sidecar is installed', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockResolvedValue(available('DBY'))
    dependencies.getVerseText.mockResolvedValue('Au commencement')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: {
          versionId: 'DBY',
          datasetId: 'DBY',
          isFallback: false,
        },
      })
    )
    expect(dependencies.getAvailability).toHaveBeenCalledTimes(1)
  })

  it('falls back to the configured Strong Bible and discloses its provenance', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability
      .mockResolvedValueOnce({ status: 'missing' })
      .mockResolvedValueOnce(available('LSG'))
    dependencies.getVerseText.mockResolvedValue('Au commencement')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: {
          versionId: 'LSG',
          datasetId: 'LSG',
          isFallback: true,
        },
      })
    )
  })

  it('uses the configured default before same-language fallbacks', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockImplementation(async versionId =>
      versionId === 'LSG' ? available('LSG') : { status: 'missing' }
    )
    dependencies.getVerseText.mockResolvedValue('Au commencement')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'ASV',
      defaultVersionId: 'LSG',
      fallbackVersionIds: ['KJV', 'NASB2020', 'ASV'],
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: {
          versionId: 'LSG',
          datasetId: 'LSG',
          isFallback: true,
        },
      })
    )
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(1, 'ASV')
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(2, 'LSG')
  })

  it('keeps French fallbacks after an unavailable English default', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockImplementation(async versionId =>
      versionId === 'DBY' ? available('DBY') : { status: 'missing' }
    )
    dependencies.getVerseText.mockResolvedValue('Au commencement')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BFC',
      defaultVersionId: 'KJV',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: expect.objectContaining({ versionId: 'DBY' }),
      })
    )
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(1, 'KJV')
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(2, 'LSG')
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(3, 'DBY')
  })

  it('keeps English fallbacks after an unavailable French default', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockImplementation(async versionId =>
      versionId === 'KJV'
        ? {
            ...available('LSG'),
            versionId: 'KJV',
            datasetId: 'KJV',
          }
        : { status: 'missing' }
    )
    dependencies.getVerseText.mockResolvedValue('In the beginning')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'NIV',
      defaultVersionId: 'LSG',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: expect.objectContaining({ versionId: 'KJV' }),
      })
    )
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(1, 'LSG')
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(2, 'KJV')
  })

  it('uses the next installed Strong Bible from the default fallback order', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability
      .mockResolvedValueOnce({ status: 'missing' })
      .mockResolvedValueOnce(available('DBY'))
    dependencies.getVerseText.mockResolvedValue('Au commencement')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BFC',
      defaultVersionId: 'LSG',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: {
          versionId: 'DBY',
          datasetId: 'DBY',
          isFallback: true,
        },
      })
    )
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(1, 'LSG')
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(2, 'DBY')
  })

  it('uses an installed manual Strong Bible choice before the current Bible', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockResolvedValue(available('DBR'))
    dependencies.getVerseText.mockResolvedValue('Au commencement')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      preferredVersionId: 'DBR',
      fallbackVersionIds: ['LSG', 'DBY', 'DBR'],
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: {
          versionId: 'DBR',
          datasetId: 'DBYR',
          isFallback: true,
        },
      })
    )
    expect(dependencies.getAvailability).toHaveBeenCalledTimes(1)
    expect(dependencies.getAvailability).toHaveBeenCalledWith('DBR')
  })

  it('returns to automatic resolution when a manual Strong Bible choice is unavailable', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability
      .mockResolvedValueOnce({ status: 'missing' })
      .mockResolvedValueOnce(available('DBY'))
    dependencies.getVerseText.mockResolvedValue('Au commencement')
    dependencies.getVerseSpans.mockResolvedValue([])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      preferredVersionId: 'DBR',
      fallbackVersionIds: ['LSG', 'DBY', 'DBR'],
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: {
          versionId: 'DBY',
          datasetId: 'DBY',
          isFallback: false,
        },
      })
    )
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(1, 'DBR')
    expect(dependencies.getAvailability).toHaveBeenNthCalledWith(2, 'DBY')
  })

  it('returns an actionable unavailable state when no fallback sidecar can be used', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability
      .mockResolvedValueOnce({ status: 'base-missing' })
      .mockResolvedValueOnce({
        status: 'incompatible',
        baseTextRevision: 'new',
        sidecarTextRevision: 'old',
      })
      .mockResolvedValueOnce({ status: 'missing' })
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual({
      status: 'unavailable',
      attempts: [
        { versionId: 'DBY', status: 'base-missing' },
        { versionId: 'LSG', status: 'incompatible' },
        { versionId: 'DBR', status: 'missing' },
      ],
    })
    expect(dependencies.getVerseText).not.toHaveBeenCalled()
  })

  it('paginates in SQLite and loads sidecar spans once per chapter', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockResolvedValue(available('DBY'))
    dependencies.getFoundVerseLocations.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1 },
      { Livre: 1, Chapitre: 1, Verset: 2 },
      { Livre: 1, Chapitre: 2, Verset: 1 },
    ])
    dependencies.getResolvedIdentity.mockResolvedValue({
      id: 42,
      kind: 'dstrong',
      code: 'H7225A',
    })
    dependencies.getMultipleVerses.mockResolvedValue({
      '1-1-1': 'Au commencement',
      '1-1-2': 'La terre',
      '1-2-1': 'Ainsi furent achevés',
    })
    dependencies.getChapterSpans
      .mockResolvedValueOnce({ 1: [], 2: [] })
      .mockResolvedValueOnce({ 1: [] })
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadFoundVersesByBook({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      book: 1,
      reference: '7225',
      limit: 15,
      offset: 30,
    })

    expect(result.status).toBe('available')
    expect(result).toEqual(
      expect.objectContaining({
        identity: { id: 42, kind: 'dstrong', code: 'H7225A' },
      })
    )
    expect(dependencies.getFoundVerseLocations).toHaveBeenCalledWith('DBY', 1, '7225', {
      limit: 15,
      offset: 30,
    })
    expect(dependencies.getChapterSpans).toHaveBeenCalledTimes(2)
    expect(dependencies.getChapterSpans).toHaveBeenNthCalledWith(1, 'DBY', 1, 1)
    expect(dependencies.getChapterSpans).toHaveBeenNthCalledWith(2, 'DBY', 1, 2)
    expect(dependencies.getVerseSpans).not.toHaveBeenCalled()
  })

  it('keeps Strong spans on concordance verses so empty occurrences remain positionable', async () => {
    const dependencies = createDependencies()
    const spans = [
      {
        ordinal: 0,
        startOffset: 2,
        length: 0,
        identities: [{ kind: 'strong' as const, code: 'H0347' }],
      },
    ]
    dependencies.getAvailability.mockResolvedValue(available('LSG'))
    dependencies.getFoundVerseLocations.mockResolvedValue([{ Livre: 18, Chapitre: 3, Verset: 2 }])
    dependencies.getResolvedIdentity.mockResolvedValue({
      id: 347,
      kind: 'strong',
      code: 'H0347',
    })
    dependencies.getMultipleVerses.mockResolvedValue({
      '18-3-2': 'Il prit la parole et dit :',
    })
    dependencies.getChapterSpans.mockResolvedValue({ 2: spans })
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadFoundVersesByBook({
      currentVersionId: 'LSG',
      defaultVersionId: 'LSG',
      book: 18,
      reference: 'H0347',
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        verses: [
          expect.objectContaining({
            Texte: 'Il prit la parole et dit :',
            StrongSpans: spans,
          }),
        ],
      })
    )
  })

  it('loads an all-Bible concordance page with an optional French lemma filter', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockResolvedValue(available('DBY'))
    dependencies.getFoundVerseLocations.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1 },
      { Livre: 40, Chapitre: 1, Verset: 1 },
    ])
    dependencies.getMultipleVerses.mockResolvedValue({
      '1-1-1': 'Au commencement',
      '40-1-1': 'Généalogie',
    })
    dependencies.getChapterSpans.mockResolvedValue({ 1: [] })
    const access = createStrongBibleResourceAccess(dependencies)

    await access.loadFoundVersesByBook({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      book: 1,
      reference: 'H7225G',
      limit: 20,
      allBooks: true,
      lexemeId: 2671,
    })

    expect(dependencies.getFoundVerseLocations).toHaveBeenCalledWith('DBY', 1, 'H7225G', {
      limit: 20,
      offset: undefined,
      allBooks: true,
      lexemeId: 2671,
    })
    expect(dependencies.getChapterSpans).toHaveBeenCalledWith('DBY', 1, 1)
    expect(dependencies.getChapterSpans).toHaveBeenCalledWith('DBY', 40, 1)
  })

  it('returns grouped French lemma statistics for the resolved version', async () => {
    const dependencies = createDependencies()
    dependencies.getAvailability.mockResolvedValue(available('DBY'))
    dependencies.getLemmaStats.mockResolvedValue([
      { id: 1, lemma: 'commencement', partOfSpeech: 'n', occurrenceCount: 19 },
    ])
    const access = createStrongBibleResourceAccess(dependencies)

    const result = await access.loadLemmaStats({
      currentVersionId: 'DBY',
      defaultVersionId: 'LSG',
      book: 1,
      reference: 'H7225G',
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        lemmas: [{ id: 1, lemma: 'commencement', partOfSpeech: 'n', occurrenceCount: 19 }],
      })
    )
  })
})
