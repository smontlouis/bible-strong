import { withResourceSourceLogging } from '../resourceSourceLogger'
import {
  createHybridBibleChapterAdapter,
  isUsableBibleCoverage,
  type BibleChapterAdapter,
  type BibleCoverageSourceResult,
} from '../bibleChapterSource'

describe('resource source development logger', () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation()

  beforeEach(() => consoleLog.mockClear())
  afterAll(() => consoleLog.mockRestore())

  it('logs the adapter that successfully loaded a resource', async () => {
    const adapter = withResourceSourceLogging(
      {
        loadChapter: async (version: string, book: number, chapter: number) => ({
          status: 'available' as const,
          version,
          book,
          chapter,
        }),
      },
      { resource: 'Bible', source: 'offline', enabled: true }
    )

    await adapter.loadChapter('DBY', 1, 2)

    expect(consoleLog).toHaveBeenCalledWith(
      '[ResourceSource] Bible · OFFLINE · loadChapter · DBY · 1 · 2'
    )
  })

  it('does not log availability failures or anything when disabled', async () => {
    const unavailable = withResourceSourceLogging(
      { loadItem: async () => ({ status: 'unavailable' as const }) },
      { resource: 'Nave', source: 'online', enabled: true }
    )
    const production = withResourceSourceLogging(
      { loadItem: async () => ({ status: 'available' as const }) },
      { resource: 'Nave', source: 'online', enabled: false }
    )

    await unavailable.loadItem()
    await production.loadItem()

    expect(consoleLog).not.toHaveBeenCalled()
  })

  it('preserves synchronous adapter methods', () => {
    const adapter = withResourceSourceLogging(
      { loadCached: () => 'cached value' },
      { resource: 'Cache', source: 'offline', enabled: true }
    )

    expect(adapter.loadCached()).toBe('cached value')
    expect(consoleLog).toHaveBeenCalledWith('[ResourceSource] Cache · OFFLINE · loadCached')
  })

  it('distinguishes array arguments from array results', async () => {
    const adapter = withResourceSourceLogging(
      {
        loadChapterEntities: async (
          _book: number,
          _chapter: number,
          _language: string,
          _strongCodes: string[]
        ) => ['Jesus', 'Jerusalem'],
      },
      { resource: 'Strong lexicon', source: 'online', enabled: true }
    )

    await adapter.loadChapterEntities(40, 21, 'fr', ['G2424', 'G2414', 'G1519'])

    expect(consoleLog).toHaveBeenCalledWith(
      '[ResourceSource] Strong lexicon · ONLINE · loadChapterEntities · 40 · 21 · fr · strongCodes=3 · result=2'
    )
  })

  it('logs only the online source when the installed Bible is unavailable', async () => {
    const offline = withResourceSourceLogging<BibleChapterAdapter>(
      {
        loadChapter: async () => ({
          status: 'unavailable',
          reason: 'publication-not-available',
        }),
        loadCoverage: async () => ({
          status: 'unavailable',
          reason: 'publication-not-available',
        }),
      },
      { resource: 'Bible', source: 'offline', enabled: true }
    )
    const online = withResourceSourceLogging<BibleChapterAdapter>(
      {
        loadChapter: async () => ({ status: 'available', verses: [] }),
        loadCoverage: async () => ({
          status: 'available',
          coverage: {
            books: [],
            chaptersByBook: {},
            verseCountByBookChapter: {},
            canon: { id: 'protestant-66', orderedBooks: [] },
            versification: 'bible-strong',
          },
        }),
      },
      { resource: 'Bible', source: 'online', enabled: true }
    )

    await createHybridBibleChapterAdapter({ offline, online }).loadChapter('DBY', 1, 2)

    expect(consoleLog).toHaveBeenCalledTimes(1)
    expect(consoleLog).toHaveBeenCalledWith(
      '[ResourceSource] Bible · ONLINE · loadChapter · DBY · 1 · 2'
    )
  })

  it('does not log an empty local coverage rejected by the hybrid adapter', async () => {
    const coverage = (books: number[]) => ({
      status: 'available' as const,
      coverage: {
        books,
        chaptersByBook: {},
        verseCountByBookChapter: {},
      },
    })
    const offline = withResourceSourceLogging<BibleChapterAdapter>(
      {
        loadChapter: async () => ({ status: 'available', verses: [] }),
        loadCoverage: async () => coverage([]),
      },
      {
        resource: 'Bible',
        source: 'offline',
        enabled: true,
        isResolvedResult: (operation, result) =>
          operation !== 'loadCoverage' ||
          isUsableBibleCoverage(result as BibleCoverageSourceResult),
      }
    )
    const online = withResourceSourceLogging<BibleChapterAdapter>(
      {
        loadChapter: async () => ({ status: 'available', verses: [] }),
        loadCoverage: async () => coverage([1]),
      },
      { resource: 'Bible', source: 'online', enabled: true }
    )

    await createHybridBibleChapterAdapter({ offline, online }).loadCoverage('LSG')

    expect(consoleLog).toHaveBeenCalledTimes(1)
    expect(consoleLog).toHaveBeenCalledWith('[ResourceSource] Bible · ONLINE · loadCoverage · LSG')
  })
})
