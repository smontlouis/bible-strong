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

  it('loads each parallel version with its own Strong mode', async () => {
    const resources = createResources()

    await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        parallelColumns: [
          { version: 'KJV', strongMode: 'visible' },
          { version: 'BSB', strongMode: 'hidden' },
        ],
        defaultInterlinearLocale: 'fr',
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
      strongMode: 'hidden',
      interlinearLocale: 'fr',
      interlinearLocaleAutomatic: true,
    })
  })

  it('loads the same version twice with different modes', async () => {
    const resources = createResources()

    await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        parallelColumns: [
          { version: 'LSG', strongMode: 'reverse-interlinear', interlinearLocale: 'en' },
          { version: 'LSG', strongMode: 'hidden' },
        ],
        defaultInterlinearLocale: 'fr',
      },
      resources
    )

    expect(resources.bibleContent.loadChapter).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        version: 'LSG',
        strongMode: 'reverse-interlinear',
        interlinearLocale: 'en',
        interlinearLocaleAutomatic: false,
      })
    )
    expect(resources.bibleContent.loadChapter).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ version: 'LSG', strongMode: 'hidden' })
    )
  })

  it.each(['visible', 'reverse-interlinear'] as const)(
    'loads plain text for a parallel Bible without the %s capability',
    async strongMode => {
      const resources = createResources()

      await loadBibleReadingParallelVerses(
        {
          book: 1,
          chapter: 1,
          parallelColumns: [{ version: 'BDS', strongMode }],
          defaultInterlinearLocale: 'fr',
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
        parallelColumns: [{ version: 'LSG', strongMode: 'visible' }],
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

  it('does not apply an interlinear mode to a Bible without interlinear', async () => {
    const resources = createResources()

    await loadBibleReadingParallelVerses(
      {
        book: 1,
        chapter: 1,
        parallelColumns: [{ version: 'BDS', interlinearMode: 'interlinear' }],
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
        parallelColumns: [{ version: 'BHG', interlinearMode: 'interlinear' }],
      },
      resources
    )

    expect(resources.bibleContent.loadChapter).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'BHG', interlinearMode: 'interlinear' })
    )
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'BHG',
        interlinearMode: 'interlinear',
        error: expect.objectContaining({ type: 'RESOURCE_UNAVAILABLE' }),
      })
    )
  })

  it('loads a BHG column without its interlinear mode as plain original text', async () => {
    const resources = createResources()

    const result = await loadBibleReadingParallelVerses(
      { book: 1, chapter: 1, parallelColumns: [{ version: 'BHG' }] },
      resources
    )

    expect(resources.bibleContent.loadChapter).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'BHG', strongMode: 'hidden', interlinearMode: 'hidden' })
    )
    expect(result[0]).toEqual(expect.objectContaining({ interlinearMode: 'hidden' }))
  })

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
        parallelColumns: [{ version: 'KJV' }, { version: 'BSB' }],
      },
      resources
    )

    expect(resources.bibleContent.loadChapters).toHaveBeenCalledTimes(1)
    expect(resources.bibleContent.loadChapter).not.toHaveBeenCalled()
  })
})
