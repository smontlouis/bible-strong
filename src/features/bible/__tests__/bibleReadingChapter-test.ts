import {
  loadBibleReadingMain,
  loadBibleReadingParallelVerses,
  loadBibleReadingRedWords,
} from '../bibleReadingChapter'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))
jest.mock('~features/resources/resourceAccess', () => ({
  defaultResourceAccess: {},
}))

const createResources = () =>
  ({
    bibleContent: {
      loadChapter: jest.fn().mockResolvedValue({
        success: true,
        data: [
          {
            Livre: 1,
            Chapitre: 1,
            Verset: 1,
            Texte: 'In the beginning',
            Headings: [
              {
                offset: 0,
                order: 0,
                kind: 'pericope',
                type: 'section',
                text: 'The Creation',
                markup: '<title type="section">The Creation</title>',
              },
            ],
          },
        ],
      }),
    },
    bibleReading: {
      loadPericope: jest.fn(),
      loadRedWords: jest.fn(),
    },
  }) as unknown as ResourceAccessRegistry

describe('canonical V4 Bible chapter extras', () => {
  it('loads headings from the canonical chapter without consulting legacy pericopes', async () => {
    const resources = createResources()

    const result = await loadBibleReadingMain({ book: 1, chapter: 1, version: 'KJV' }, resources)

    expect(result.pericope).toEqual({
      '1': { '1': { '1': { h3: 'The Creation' } } },
    })
    expect(resources.bibleReading.loadPericope).not.toHaveBeenCalled()
  })

  it('does not consult legacy red-word JSON for a canonical V4 publication', async () => {
    const resources = createResources()

    await expect(
      loadBibleReadingRedWords({ book: 40, chapter: 5, version: 'NASB2020' }, resources)
    ).resolves.toBeNull()
    expect(resources.bibleReading.loadRedWords).not.toHaveBeenCalled()
  })

  it('does not fall back to legacy pericopes when a canonical V4 chapter is unavailable', async () => {
    const resources = createResources()
    ;(resources.bibleContent.loadChapter as jest.Mock).mockResolvedValue({
      success: false,
      error: { type: 'VERSION_NOT_FOUND' },
    })

    const result = await loadBibleReadingMain({ book: 1, chapter: 1, version: 'KJV' }, resources)

    expect(result.pericope).toEqual({})
    expect(resources.bibleReading.loadPericope).not.toHaveBeenCalled()
  })

  it('loads Strong data for every compatible parallel version', async () => {
    const resources = createResources()

    await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        version: 'LSG',
        parallelVersions: ['KJV', 'BSB'],
        commentsDisplay: false,
        strongMode: 'visible',
        interlinearLocale: 'fr',
        interlinearLocaleAutomatic: true,
      },
      resources
    )

    expect(resources.bibleContent.loadChapter).toHaveBeenNthCalledWith(1, {
      book: 1,
      chapter: 1,
      version: 'KJV',
      strongMode: 'visible',
      interlinearLocale: 'fr',
      interlinearLocaleAutomatic: true,
    })
    expect(resources.bibleContent.loadChapter).toHaveBeenNthCalledWith(2, {
      book: 1,
      chapter: 1,
      version: 'BSB',
      strongMode: 'visible',
      interlinearLocale: 'fr',
      interlinearLocaleAutomatic: true,
    })
  })
})
