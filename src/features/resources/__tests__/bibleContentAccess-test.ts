/* eslint-disable import/first */

jest.mock('~helpers/biblesDb', () => ({
  getChapterVerses: jest.fn(),
  getVerseText: jest.fn(),
}))

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

jest.mock('~helpers/strongBibleSidecar', () => ({
  loadStrongBibleChapterSpans: jest.fn(),
}))

jest.mock('~helpers/interlinearBibleSidecar', () => ({
  loadInterlinearChapterTokens: jest.fn(),
}))

jest.mock('~helpers/bibleVersions', () => ({
  getIfVersionNeedsDownload: jest.fn(),
}))

jest.mock('~helpers/loadInterlineaireChapter', () => jest.fn())

jest.mock('~helpers/loadStrongChapter', () => jest.fn())

jest.mock('~helpers/sqlite', () => ({
  strongDB: {
    get: jest.fn(),
    init: jest.fn(),
  },
}))

jest.mock('../strongAccess', () => ({
  localStrongAccess: {
    loadChapter: jest.fn(),
  },
}))

import { BibleLoadingError } from '~helpers/bibleErrors'
import { loadBibleContentChapter } from '../bibleContentAccess'

const createDependencies = () => ({
  loadInterlinearChapter: jest.fn(),
  strongAccess: {
    loadChapter: jest.fn(),
  },
  getChapterVerses: jest.fn(),
  getIfVersionNeedsDownload: jest.fn(async () => false),
  initStrongDatabase: jest.fn(async () => true),
  isStrongDatabaseInitialized: jest.fn(() => true),
  logError: jest.fn(),
})

describe('BibleContentAccess', () => {
  it('loads regular Bible chapters from regular chapter verses', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'In the beginning' },
    ])

    await expect(
      loadBibleContentChapter({ book: 1, chapter: 1, version: 'LSG' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'In the beginning' }],
      })
    )

    expect(dependencies.getChapterVerses).toHaveBeenCalledWith('LSG', 1, 1)
  })

  it('keeps BHG as a normal original-language Bible when interlinear mode is hidden', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' },
    ])
    const loadInterlinearChapterTokens = jest.fn()

    await expect(
      loadBibleContentChapter(
        { book: 1, chapter: 1, version: 'BHG', interlinearMode: 'hidden' },
        { ...dependencies, loadInterlinearChapterTokens }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' }],
      })
    )
    expect(loadInterlinearChapterTokens).not.toHaveBeenCalled()
  })

  it('overlays the localized interlinear index without replacing canonical BHG text', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' },
    ])
    const tokens = [
      {
        ordinal: 0,
        startOffset: 0,
        length: 8,
        segments: [],
      },
    ]
    const loadInterlinearChapterTokens = jest.fn().mockResolvedValue({ 1: tokens })

    await expect(
      loadBibleContentChapter(
        {
          book: 1,
          chapter: 1,
          version: 'BHG',
          interlinearMode: 'visible',
          interlinearLocale: 'en',
        },
        { ...dependencies, loadInterlinearChapterTokens }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: [
          expect.objectContaining({
            Texte: 'בְּרֵאשִׁית',
            InterlinearTokens: tokens,
          }),
        ],
      })
    )
    expect(loadInterlinearChapterTokens).toHaveBeenCalledWith('BHG', 'en', 1, 1)
  })

  it('falls back to canonical BHG text when the interlinear index cannot be loaded', async () => {
    const dependencies = createDependencies()
    const verses = [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' }]
    dependencies.getChapterVerses.mockResolvedValue(verses)
    const loadInterlinearChapterTokens = jest.fn().mockRejectedValue(new Error('missing'))

    await expect(
      loadBibleContentChapter(
        {
          book: 1,
          chapter: 1,
          version: 'BHG',
          interlinearMode: 'visible',
          interlinearLocale: 'fr',
        },
        { ...dependencies, loadInterlinearChapterTokens }
      )
    ).resolves.toEqual(expect.objectContaining({ success: true, data: verses }))
    expect(dependencies.logError).toHaveBeenCalled()
  })

  it('routes French interlinear versions to French interlinear content', async () => {
    const dependencies = createDependencies()
    dependencies.loadInterlinearChapter.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בראשית' },
    ])

    await loadBibleContentChapter({ book: 1, chapter: 1, version: 'INT' }, dependencies)

    expect(dependencies.loadInterlinearChapter).toHaveBeenCalledWith(1, 1, 'fr')
  })

  it('routes English interlinear versions to English interlinear content', async () => {
    const dependencies = createDependencies()
    dependencies.loadInterlinearChapter.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'In beginning' },
    ])

    await loadBibleContentChapter({ book: 1, chapter: 1, version: 'INT_EN' }, dependencies)

    expect(dependencies.loadInterlinearChapter).toHaveBeenCalledWith(1, 1, 'en')
  })

  it('migrates legacy LSGS reads to canonical LSG with Strong visible', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'canonical text' },
    ])
    const loadStrongBibleChapterSpans = jest.fn().mockResolvedValue({
      1: [
        {
          ordinal: 0,
          startOffset: 0,
          length: 9,
          identities: [{ kind: 'strong', code: 'H0001' }],
        },
      ],
    })

    await expect(
      loadBibleContentChapter(
        { book: 1, chapter: 1, version: 'LSGS' },
        { ...dependencies, loadStrongBibleChapterSpans }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: [
          expect.objectContaining({
            Texte: 'canonical text',
            StrongSpans: expect.any(Array),
          }),
        ],
      })
    )

    expect(dependencies.getChapterVerses).toHaveBeenCalledWith('LSG', 1, 1)
    expect(dependencies.strongAccess.loadChapter).not.toHaveBeenCalled()
  })

  it('returns BIBLE_NOT_FOUND when a chapter has no rows and the version needs download', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([])
    dependencies.getIfVersionNeedsDownload.mockResolvedValue(true)

    await expect(
      loadBibleContentChapter({ book: 1, chapter: 1, version: 'LSG' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'BIBLE_NOT_FOUND' }),
      })
    )
  })

  it('returns CHAPTER_NOT_FOUND when a chapter has no rows but the version is installed', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([])

    await expect(
      loadBibleContentChapter({ book: 1, chapter: 999, version: 'LSG' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'CHAPTER_NOT_FOUND' }),
      })
    )
  })

  it('maps database corruption errors to structured chapter errors', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockRejectedValue(new Error('no such table: verses'))

    await expect(
      loadBibleContentChapter({ book: 1, chapter: 1, version: 'LSG' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'DATABASE_CORRUPTED' }),
      })
    )
  })

  it('preserves structured Bible loading errors', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockRejectedValue(new BibleLoadingError('BIBLE_NOT_FOUND', 'LSG'))

    await expect(
      loadBibleContentChapter({ book: 1, chapter: 1, version: 'LSG' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'BIBLE_NOT_FOUND' }),
      })
    )
  })
})
