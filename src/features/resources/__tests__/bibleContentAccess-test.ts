/* eslint-disable import/first */

jest.mock('~helpers/biblesDb', () => ({
  getChapterVerses: jest.fn(),
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

  it('initializes Strong content before loading Strong Bible chapters', async () => {
    const dependencies = createDependencies()
    dependencies.isStrongDatabaseInitialized.mockReturnValue(false)
    dependencies.strongAccess.loadChapter.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'strong text' },
    ])

    await loadBibleContentChapter({ book: 1, chapter: 1, version: 'LSGS' }, dependencies)

    expect(dependencies.initStrongDatabase).toHaveBeenCalled()
    expect(dependencies.strongAccess.loadChapter).toHaveBeenCalledWith(1, 1)
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
