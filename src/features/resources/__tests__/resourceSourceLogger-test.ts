import { withResourceSourceLogging } from '../resourceSourceLogger'
import { createHybridBibleChapterAdapter, type BibleChapterAdapter } from '../bibleChapterSource'

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
})
