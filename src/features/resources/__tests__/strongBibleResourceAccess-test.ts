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
  getFoundVerseLocations: jest.fn(),
  getMultipleVerses: jest.fn(),
  annotateText: jest.fn((text: string, _spans) => `${text} 123`),
})

describe('strongBibleResourceAccess', () => {
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
    expect(dependencies.getFoundVerseLocations).toHaveBeenCalledWith('DBY', 1, '7225', {
      limit: 15,
      offset: 30,
    })
    expect(dependencies.getChapterSpans).toHaveBeenCalledTimes(2)
    expect(dependencies.getChapterSpans).toHaveBeenNthCalledWith(1, 'DBY', 1, 1)
    expect(dependencies.getChapterSpans).toHaveBeenNthCalledWith(2, 'DBY', 1, 2)
    expect(dependencies.getVerseSpans).not.toHaveBeenCalled()
  })
})
