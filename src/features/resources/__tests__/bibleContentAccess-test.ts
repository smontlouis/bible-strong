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
  loadReverseInterlinearChapterSpans: jest.fn(),
}))

jest.mock('~helpers/interlinearBibleSidecar', () => ({
  loadInterlinearChapterTokens: jest.fn(),
}))

jest.mock('~helpers/bibleVersions', () => ({
  getIfVersionNeedsDownload: jest.fn(),
}))

jest.mock('~state/resourcesLanguage', () => ({
  getResourceLanguage: () => 'fr',
}))

jest.mock('../strongLexiconAccess', () => ({
  localStrongLexiconAccess: {
    loadPreview: jest.fn(),
  },
}))

import { BibleLoadingError } from '~helpers/bibleErrors'
import type { StrongLexiconPreview } from '../strongLexiconAccess'
import { loadBibleContentChapter } from '../bibleContentAccess'

const createDependencies = () => ({
  ...(() => {
    const getChapterVerses = jest.fn()
    const getIfVersionNeedsDownload = jest.fn(async (_version: string) => false)
    return {
      getChapterVerses,
      getIfVersionNeedsDownload,
      chapterAdapter: {
        loadChapter: jest.fn(async (version: string, book: number, chapter: number) => {
          try {
            const verses = await getChapterVerses(version, book, chapter)
            if (verses.length > 0) return { status: 'available' as const, verses }
            if (await getIfVersionNeedsDownload(version)) {
              return {
                status: 'unavailable' as const,
                reason: 'publication-not-available' as const,
                recoveries: ['acquire-offline-copy' as const],
              }
            }
            return { status: 'unavailable' as const, reason: 'chapter-not-available' as const }
          } catch (error) {
            if (error instanceof BibleLoadingError && error.type === 'BIBLE_NOT_FOUND') {
              return {
                status: 'unavailable' as const,
                reason: 'publication-not-available' as const,
                recoveries: ['acquire-offline-copy' as const],
              }
            }
            const message = String(error)
            if (message.includes('no such table') || message.includes('corrupted')) {
              return {
                status: 'unavailable' as const,
                reason: 'offline-copy-invalid' as const,
                recoveries: ['manage-offline-copies' as const, 'reset-offline-store' as const],
              }
            }
            throw error
          }
        }),
      },
    }
  })(),
  strongLexicon: {
    loadPreview: jest.fn(async () => [] as StrongLexiconPreview[]),
  },
  getStrongResourceLanguage: jest.fn(() => 'fr' as const),
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
        data: {
          kind: 'plain',
          verses: [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'In the beginning' }],
        },
      })
    )

    expect(dependencies.chapterAdapter.loadChapter).toHaveBeenCalledWith('LSG', 1, 1)
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
        data: {
          kind: 'plain',
          verses: [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' }],
        },
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
        data: {
          kind: 'interlinear',
          verses: [
            expect.objectContaining({
              Texte: 'בְּרֵאשִׁית',
              InterlinearTokens: tokens,
            }),
          ],
        },
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
    ).resolves.toEqual(expect.objectContaining({ success: true, data: { kind: 'plain', verses } }))
    expect(dependencies.logError).toHaveBeenCalled()
    expect(loadInterlinearChapterTokens).toHaveBeenCalledTimes(1)
  })

  it('falls back to the other gloss locale only in automatic interlinear mode', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' },
    ])
    const tokens = [{ ordinal: 0, startOffset: 0, length: 8, segments: [] }]
    const loadInterlinearChapterTokens = jest
      .fn()
      .mockRejectedValueOnce(new Error('French index missing'))
      .mockResolvedValueOnce({ 1: tokens })

    const result = await loadBibleContentChapter(
      {
        book: 1,
        chapter: 1,
        version: 'BHG',
        interlinearMode: 'interlinear',
        interlinearLocale: 'fr',
        interlinearLocaleAutomatic: true,
      },
      { ...dependencies, loadInterlinearChapterTokens }
    )

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          kind: 'interlinear',
          verses: [expect.objectContaining({ InterlinearTokens: tokens })],
        },
      })
    )
    expect(loadInterlinearChapterTokens).toHaveBeenNthCalledWith(1, 'BHG', 'fr', 1, 1)
    expect(loadInterlinearChapterTokens).toHaveBeenNthCalledWith(2, 'BHG', 'en', 1, 1)
  })

  it('allows language-neutral display modes to use either installed index', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' },
    ])
    const loadInterlinearChapterTokens = jest
      .fn()
      .mockRejectedValueOnce(new Error('French index missing'))
      .mockResolvedValueOnce({ 1: [] })

    await loadBibleContentChapter(
      {
        book: 1,
        chapter: 1,
        version: 'BHG',
        interlinearMode: 'strong',
        interlinearLocale: 'fr',
      },
      { ...dependencies, loadInterlinearChapterTokens }
    )

    expect(loadInterlinearChapterTokens).toHaveBeenNthCalledWith(1, 'BHG', 'fr', 1, 1)
    expect(loadInterlinearChapterTokens).toHaveBeenNthCalledWith(2, 'BHG', 'en', 1, 1)
  })

  it('enriches a Strong group with aligned disambiguated identities when BHG is installed', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 3, Chapitre: 1, Verset: 1, Texte: 'Then the LORD' },
    ])
    const loadStrongBibleChapterSpans = jest.fn().mockResolvedValue({
      1: [
        {
          ordinal: 0,
          startOffset: 0,
          length: 13,
          stepTokenIds: [37329, 37332],
          identities: [
            { kind: 'strong', code: 'H3068' },
            { kind: 'strong', code: 'H413' },
          ],
        },
      ],
    })
    const loadInterlinearChapterTokens = jest.fn().mockResolvedValue({
      1: [
        {
          id: 37329,
          ordinal: 0,
          startOffset: 0,
          length: 4,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 4,
              transliteration: '',
              lemma: '',
              morphology: 'HR',
              gloss: '',
              identities: [{ kind: 'strong', code: 'H0413' }],
            },
          ],
        },
        {
          id: 37332,
          ordinal: 1,
          startOffset: 5,
          length: 4,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 4,
              transliteration: '',
              lemma: '',
              morphology: 'HNp',
              gloss: '',
              identities: [
                { kind: 'strong', code: 'H3068' },
                { kind: 'dstrong', code: 'H3068G' },
              ],
            },
          ],
        },
      ],
    })

    const result = await loadBibleContentChapter(
      { book: 3, chapter: 1, version: 'BSB', strongMode: 'visible' },
      { ...dependencies, loadStrongBibleChapterSpans, loadInterlinearChapterTokens }
    )

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          kind: 'strong',
          verses: [
            expect.objectContaining({
              StrongSpans: [
                expect.objectContaining({
                  identities: [
                    { kind: 'dstrong', code: 'H3068G' },
                    { kind: 'strong', code: 'H0413' },
                  ],
                  morphologies: [
                    {
                      identity: { kind: 'dstrong', code: 'H3068G' },
                      codes: ['HNp'],
                    },
                    {
                      identity: { kind: 'strong', code: 'H0413' },
                      codes: ['HR'],
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      })
    )
  })

  it('overlays a Strong Bible with the aligned original text in reverse interlinear mode', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockImplementation(async version =>
      version === 'BHG'
        ? [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' }]
        : [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'Au commencement' }]
    )
    const loadReverseInterlinearChapterSpans = jest.fn().mockResolvedValue({
      1: [
        {
          ordinal: 0,
          startOffset: 3,
          length: 12,
          identities: [
            { kind: 'strong', code: 'H7225' },
            { kind: 'strong', code: 'H1254' },
          ],
          stepTokenIds: [1],
        },
      ],
    })
    const loadInterlinearChapterTokens = jest.fn().mockResolvedValue({
      1: [
        {
          id: 1,
          ordinal: 0,
          startOffset: 0,
          length: 11,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 11,
              transliteration: 'be.re.Shit',
              lemma: 'רֵאשִׁית',
              morphology: 'HNcfsa',
              gloss: 'commencement',
              identities: [{ kind: 'strong', code: 'H7225' }],
            },
          ],
        },
      ],
    })
    dependencies.strongLexicon.loadPreview.mockResolvedValue([
      {
        id: 1254,
        selectedIdentity: { kind: 'strong', code: 'H1254' },
        stepCode: 'H1254',
        classicStrong: 'H1254',
        language: 'hebrew',
        original: 'בָּרָא',
        transliteration: "ba.Ra'",
        gloss: 'créer',
      },
    ])

    await expect(
      loadBibleContentChapter(
        {
          book: 1,
          chapter: 1,
          version: 'LSG',
          strongMode: 'reverse-interlinear',
          interlinearLocale: 'fr',
        },
        {
          ...dependencies,
          loadReverseInterlinearChapterSpans,
          loadInterlinearChapterTokens,
        }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: {
          kind: 'reverse-interlinear',
          verses: [
            expect.objectContaining({
              Texte: 'Au commencement',
              ReverseInterlinearSpans: [
                expect.objectContaining({
                  sourceTokens: [
                    expect.objectContaining({ surface: 'בְּרֵאשִׁית' }),
                    expect.objectContaining({
                      surface: 'בָּרָא',
                      lexicalFallback: true,
                      segments: [expect.objectContaining({ morphology: '' })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        },
      })
    )

    expect(loadReverseInterlinearChapterSpans).toHaveBeenCalledWith('LSG', 1, 1)
    expect(loadInterlinearChapterTokens).toHaveBeenCalledWith('BHG', 'fr', 1, 1)
    expect(dependencies.strongLexicon.loadPreview).toHaveBeenCalledWith(
      [{ kind: 'strong', code: 'H1254' }],
      'fr'
    )
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
        error: expect.objectContaining({
          type: 'BIBLE_NOT_FOUND',
          recoveries: ['acquire-offline-copy'],
        }),
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
        error: expect.objectContaining({
          type: 'OFFLINE_COPY_INVALID',
          recoveries: ['manage-offline-copies', 'reset-offline-store'],
        }),
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
