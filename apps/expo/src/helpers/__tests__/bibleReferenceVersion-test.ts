import { selectBibleReferenceVersion } from '../bibleReferenceVersion'

jest.mock('../bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG', language: 'fr' },
    VUL: { id: 'VUL', language: 'la', canonId: 'clementine-vulgate' },
    BFC: { id: 'BFC', language: 'fr', canonId: 'catholic-73' },
    NFC: { id: 'NFC', language: 'fr', canonId: 'catholic-73' },
  },
}))

const createAccess = () => ({
  getAvailability: jest.fn(async (_version: string) => ({ status: 'available' as const })),
  loadCoverage: jest.fn(async (_version: string) => ({
    books: [67, 70],
    chaptersByBook: {},
    verseCountByBookChapter: {},
  })),
})

it('opens Sirach in an available French Bible when LSG does not contain the book', async () => {
  await expect(selectBibleReferenceVersion('LSG', [70], createAccess())).resolves.toBe('BFC')
})

it('keeps the current Bible when its canon contains the requested book', async () => {
  const access = createAccess()
  await expect(selectBibleReferenceVersion('LSG', [1], access)).resolves.toBe('LSG')
  await expect(selectBibleReferenceVersion('BFC', [70], access)).resolves.toBe('BFC')
  expect(access.loadCoverage).not.toHaveBeenCalled()
})

it('checks actual published coverage before selecting a candidate', async () => {
  const access = createAccess()
  access.loadCoverage.mockResolvedValueOnce({
    books: [67],
    chaptersByBook: {},
    verseCountByBookChapter: {},
  })
  await expect(selectBibleReferenceVersion('LSG', [70], access)).resolves.toBe('NFC')
})

it('retains the original version if no candidate can be accessed', async () => {
  const access = createAccess()
  access.getAvailability.mockRejectedValue(new Error('offline'))
  await expect(selectBibleReferenceVersion('LSG', [70], access)).resolves.toBe('LSG')
})

it('loads the Sirach reference using the selected version', async () => {
  const { resolveBibleVerses } = await import('../bibleVerseResolver')
  const version = await selectBibleReferenceVersion('LSG', [70], createAccess())
  const loadVerseTexts = jest.fn(
    async (selected: string): Promise<Record<string, string>> =>
      selected === 'BFC' ? { '70-10-27': 'Siracide' } : {}
  )
  await expect(
    resolveBibleVerses(
      { verseKeys: ['70-10-27'], preferredVersion: version, defaultVersion: 'LSG' },
      { loadVerseTexts }
    )
  ).resolves.toMatchObject({
    status: 'resolved',
    version: 'BFC',
    texts: { '70-10-27': 'Siracide' },
  })
  expect(loadVerseTexts).toHaveBeenCalledWith('BFC', ['70-10-27'])
})

it('skips unavailable candidates before reading their coverage', async () => {
  const access = createAccess()
  access.getAvailability.mockRejectedValueOnce(new Error('unavailable'))
  await expect(selectBibleReferenceVersion('LSG', [67, 70], access)).resolves.toBe('NFC')
  expect(access.loadCoverage).toHaveBeenCalledTimes(1)
  expect(access.loadCoverage).toHaveBeenCalledWith('NFC')
})
