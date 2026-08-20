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
        data: {
          kind: 'plain',
          verses: [
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
        },
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

  it.each(['visible', 'reverse-interlinear'] as const)(
    'loads plain text for a parallel Bible without the requested %s capability',
    async strongMode => {
      const resources = createResources()

      await loadBibleReadingParallelVerses(
        {
          book: 1,
          chapter: 1,
          version: 'LSG',
          parallelVersions: ['BDS'],
          commentsDisplay: false,
          strongMode,
          interlinearLocale: 'fr',
          interlinearLocaleAutomatic: true,
        },
        resources
      )

      expect(resources.bibleContent.loadChapter).toHaveBeenCalledWith({
        book: 1,
        chapter: 1,
        version: 'BDS',
        strongMode: 'hidden',
        interlinearLocale: 'fr',
        interlinearLocaleAutomatic: true,
      })
    }
  )

  it('preserves a Strong loading error for a compatible parallel Bible', async () => {
    const resources = createResources()
    ;(resources.bibleContent.loadChapter as jest.Mock).mockResolvedValue({
      success: false,
      error: { type: 'RESOURCE_UNAVAILABLE', version: 'LSG', book: 1, chapter: 1 },
    })

    const result = await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        version: 'DBY',
        parallelVersions: ['LSG'],
        commentsDisplay: false,
        strongMode: 'visible',
      },
      resources
    )

    expect(resources.bibleContent.loadChapter).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'LSG', strongMode: 'visible' })
    )
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'LSG',
        error: expect.objectContaining({ type: 'RESOURCE_UNAVAILABLE' }),
      })
    )
  })

  it('does not apply the main interlinear presentation to parallel Bible versions', async () => {
    const resources = createResources()

    await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        version: 'BHG',
        parallelVersions: ['BDS'],
        commentsDisplay: false,
        interlinearMode: 'interlinear',
      },
      resources
    )

    expect(resources.bibleContent.loadChapter).toHaveBeenCalledWith(
      expect.not.objectContaining({ interlinearMode: expect.anything() })
    )
  })

  it('keeps interlinear presentation and loading errors for a compatible parallel Bible', async () => {
    const resources = createResources()
    ;(resources.bibleContent.loadChapter as jest.Mock).mockResolvedValue({
      success: false,
      error: { type: 'RESOURCE_UNAVAILABLE', version: 'BHG', book: 1, chapter: 1 },
    })

    const result = await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        version: 'BHG',
        parallelVersions: ['BHG'],
        commentsDisplay: false,
        interlinearMode: 'interlinear',
      },
      resources
    )

    expect(resources.bibleContent.loadChapter).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'BHG', interlinearMode: 'interlinear' })
    )
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'BHG',
        error: expect.objectContaining({ type: 'RESOURCE_UNAVAILABLE' }),
      })
    )
  })

  it.each([
    ['visible', 'strong'],
    ['reverse-interlinear', 'interlinear'],
  ] as const)(
    'uses the BHG %s presentation in parallel mode',
    async (strongMode, expectedInterlinearMode) => {
      const resources = createResources()

      const result = await loadBibleReadingParallelVerses(
        {
          book: 1,
          chapter: 1,
          version: 'LSG',
          parallelVersions: ['BHG'],
          commentsDisplay: false,
          strongMode,
        },
        resources
      )

      expect(resources.bibleContent.loadChapter).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'BHG',
          strongMode: 'hidden',
          interlinearMode: expectedInterlinearMode,
        })
      )
      expect(result[0]).toEqual(
        expect.objectContaining({ interlinearMode: expectedInterlinearMode })
      )
    }
  )

  it('groups plain parallel versions through the batch chapter access', async () => {
    const resources = createResources()
    resources.bibleContent.loadChapters = jest.fn().mockResolvedValue([
      { success: true, data: { kind: 'plain', verses: [] } },
      { success: true, data: { kind: 'plain', verses: [] } },
    ])

    await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        version: 'LSG',
        parallelVersions: ['KJV', 'BSB'],
        commentsDisplay: false,
      },
      resources
    )

    expect(resources.bibleContent.loadChapters).toHaveBeenCalledTimes(1)
    expect(resources.bibleContent.loadChapter).not.toHaveBeenCalled()
  })
})
