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
  getBibleVersionCanonId: jest.fn(() => 'protestant-66'),
  getIfVersionNeedsDownload: jest.fn(),
}))

jest.mock('~state/resourcesLanguage', () => ({
  getResourceLanguage: () => 'fr',
}))

import { BibleLoadingError } from '~helpers/bibleErrors'
import { getChapterVerses } from '~helpers/biblesDb'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import {
  createBibleContentAccess,
  loadBibleContentChapter,
  localBibleChapterAdapter,
} from '../bibleContentAccess'
import type { BibleChapterAdapter } from '../bibleChapterSource'
import { ResourceAccessError } from '../resourceAccessError'

const createDependencies = () => ({
  ...(() => {
    const getChapterVerses = jest.fn()
    const getIfVersionNeedsDownload = jest.fn(async (_version: string) => false)
    const chapterAdapter: jest.Mocked<BibleChapterAdapter> = {
      loadCoverage: jest.fn(),
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
    }
    return {
      getChapterVerses,
      getIfVersionNeedsDownload,
      chapterAdapter,
    }
  })(),
  logError: jest.fn(),
})

describe('BibleContentAccess', () => {
  it('fails explicitly when Strong presentation is requested for an unsupported Bible', async () => {
    const dependencies = createDependencies()

    await expect(
      loadBibleContentChapter(
        { book: 1, chapter: 1, version: 'BFC', strongMode: 'visible' },
        dependencies
      )
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'RESOURCE_UNSUPPORTED' }),
      })
    )
    expect(dependencies.chapterAdapter.loadChapter).not.toHaveBeenCalled()
  })

  it('fails Strong mode when its sidecar belongs to a different revision or hash', async () => {
    const dependencies = createDependencies()
    dependencies.chapterAdapter.loadChapter.mockResolvedValue({
      status: 'available',
      textRevision: 'stale-local-revision',
      textSha256: '0'.repeat(64),
      verses: [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'Texte local ancien' }],
    } as Awaited<ReturnType<BibleChapterAdapter['loadChapter']>>)
    const loadStrongBibleChapterSpans = jest.fn().mockResolvedValue({
      spansByVerse: { 1: [] },
      textRevision: 'lsg-text-v1',
      textSha256: '1'.repeat(64),
    })

    const result = await loadBibleContentChapter(
      { book: 1, chapter: 1, version: 'LSG', strongMode: 'visible' },
      { ...dependencies, loadStrongBibleChapterSpans }
    )

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'RESOURCE_INTEGRITY_ERROR' }),
      })
    )
    expect(dependencies.logError).toHaveBeenCalledWith(
      '[BibleContentAccess] Error loading chapter:',
      expect.objectContaining({ code: 'INTEGRITY_FAILURE' })
    )
  })

  it('classifies a missing canonical chapter in an installed Bible as an invalid copy', async () => {
    ;(getChapterVerses as jest.MockedFunction<typeof getChapterVerses>).mockResolvedValue([])
    ;(
      getIfVersionNeedsDownload as jest.MockedFunction<typeof getIfVersionNeedsDownload>
    ).mockResolvedValue(false)

    await expect(localBibleChapterAdapter.loadChapter('LSG', 1, 1)).resolves.toEqual({
      status: 'unavailable',
      reason: 'offline-copy-invalid',
      recoveries: ['manage-offline-copies', 'reset-offline-store'],
    })
  })

  it('keeps a chapter outside the declared canon as a genuine domain absence', async () => {
    ;(getChapterVerses as jest.MockedFunction<typeof getChapterVerses>).mockResolvedValue([])
    ;(
      getIfVersionNeedsDownload as jest.MockedFunction<typeof getIfVersionNeedsDownload>
    ).mockResolvedValue(false)

    await expect(localBibleChapterAdapter.loadChapter('LSG', 1, 999)).resolves.toEqual({
      status: 'unavailable',
      reason: 'chapter-not-available',
    })
  })

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
          presentation: 'canonical',
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
          presentation: 'legacy-sidecars',
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
          presentation: 'legacy-sidecars',
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

  it('fails the requested BHG interlinear mode when its index cannot be loaded', async () => {
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
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'UNKNOWN_ERROR' }),
      })
    )
    expect(dependencies.logError).toHaveBeenCalled()
    expect(loadInterlinearChapterTokens).toHaveBeenCalledTimes(1)
  })

  it('does not switch gloss locale after the selected index fails', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' },
    ])
    const loadInterlinearChapterTokens = jest
      .fn()
      .mockRejectedValue(new Error('French index missing'))

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
        success: false,
        error: expect.objectContaining({ type: 'UNKNOWN_ERROR' }),
      })
    )
    expect(loadInterlinearChapterTokens).toHaveBeenCalledTimes(1)
    expect(loadInterlinearChapterTokens).toHaveBeenCalledWith('BHG', 'fr', 1, 1)
  })

  it('selects another locale before loading when automatic mode declares the preferred one missing', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' },
    ])
    const getInterlinearAvailability = jest
      .fn()
      .mockResolvedValueOnce({ status: 'missing' })
      .mockResolvedValueOnce({ status: 'available', locale: 'en', textRevision: 'bhg-v1' })
    const loadInterlinearChapterTokens = jest.fn().mockResolvedValue({
      1: [{ ordinal: 0, startOffset: 0, length: 1, segments: [] }],
    })

    const result = await loadBibleContentChapter(
      {
        book: 1,
        chapter: 1,
        version: 'BHG',
        interlinearMode: 'interlinear',
        interlinearLocale: 'fr',
        interlinearLocaleAutomatic: true,
      },
      { ...dependencies, getInterlinearAvailability, loadInterlinearChapterTokens }
    )

    expect(result).toEqual(expect.objectContaining({ success: true }))
    expect(getInterlinearAvailability).toHaveBeenNthCalledWith(1, 'fr')
    expect(getInterlinearAvailability).toHaveBeenNthCalledWith(2, 'en')
    expect(loadInterlinearChapterTokens).toHaveBeenCalledWith('BHG', 'en', 1, 1)
  })

  it('does not switch locale for a language-neutral display mode after a load failure', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockResolvedValue([
      { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית' },
    ])
    const loadInterlinearChapterTokens = jest
      .fn()
      .mockRejectedValueOnce(new Error('French index missing'))
      .mockResolvedValueOnce({ 1: [] })

    const result = await loadBibleContentChapter(
      {
        book: 1,
        chapter: 1,
        version: 'BHG',
        interlinearMode: 'strong',
        interlinearLocale: 'fr',
      },
      { ...dependencies, loadInterlinearChapterTokens }
    )

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'UNKNOWN_ERROR' }),
      })
    )
    expect(loadInterlinearChapterTokens).toHaveBeenCalledTimes(1)
    expect(loadInterlinearChapterTokens).toHaveBeenCalledWith('BHG', 'fr', 1, 1)
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
          presentation: 'canonical',
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
        ? [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'בְּרֵאשִׁית בָּרָא' }]
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
          stepTokenIds: [1, 2],
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
        {
          id: 2,
          ordinal: 1,
          startOffset: 12,
          length: 5,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 5,
              transliteration: "ba.Ra'",
              lemma: 'בָּרָא',
              morphology: 'HVqp3ms',
              gloss: 'créer',
              identities: [{ kind: 'strong', code: 'H1254' }],
            },
          ],
        },
      ],
    })
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
          presentation: 'canonical',
          verses: [
            expect.objectContaining({
              Texte: 'Au commencement',
              ReverseInterlinearSpans: [
                expect.objectContaining({
                  sourceTokens: [
                    expect.objectContaining({ surface: 'בְּרֵאשִׁית' }),
                    expect.objectContaining({
                      segments: [expect.objectContaining({ morphology: 'HVqp3ms' })],
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
  })

  it('resolves reverse-interlinear token ids across shifted Psalm verse numbers', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockImplementation(async version =>
      version === 'BHG'
        ? [{ Livre: 19, Chapitre: 5, Verset: 0, Texte: 'לַמְנַצֵּחַ' }]
        : [{ Livre: 19, Chapitre: 5, Verset: 1, Texte: 'Au chef de musique' }]
    )
    const loadReverseInterlinearChapterSpans = jest.fn().mockResolvedValue({
      1: [
        {
          ordinal: 0,
          startOffset: 0,
          length: 18,
          identities: [{ kind: 'strong', code: 'H5329' }],
          stepTokenIds: [195899],
        },
      ],
    })
    const loadInterlinearChapterTokens = jest.fn().mockResolvedValue({
      0: [
        {
          id: 195899,
          ordinal: 0,
          startOffset: 0,
          length: 11,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 11,
              transliteration: 'lamnatseach',
              lemma: 'נָצַח',
              morphology: 'HVpc',
              gloss: 'chef de musique',
              identities: [{ kind: 'strong', code: 'H5329' }],
            },
          ],
        },
      ],
    })

    const result = await loadBibleContentChapter(
      {
        book: 19,
        chapter: 5,
        version: 'DBR',
        strongMode: 'reverse-interlinear',
        interlinearLocale: 'fr',
      },
      {
        ...dependencies,
        loadReverseInterlinearChapterSpans,
        loadInterlinearChapterTokens,
      }
    )

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          kind: 'reverse-interlinear',
          verses: [
            expect.objectContaining({
              ReverseInterlinearSpans: [
                expect.objectContaining({
                  sourceTokens: [expect.objectContaining({ id: 195899 })],
                }),
              ],
            }),
          ],
        }),
      })
    )
  })

  it('fails the requested reverse interlinear mode without another locale or lexical reconstruction', async () => {
    const dependencies = createDependencies()
    dependencies.getChapterVerses.mockImplementation(async version =>
      version === 'BHG'
        ? [{ Livre: 5, Chapitre: 12, Verset: 1, Texte: 'אֵלֶּה' }]
        : [{ Livre: 5, Chapitre: 12, Verset: 1, Texte: 'Voici' }]
    )
    const loadReverseInterlinearChapterSpans = jest.fn().mockResolvedValue({
      1: [
        {
          ordinal: 0,
          startOffset: 0,
          length: 5,
          identities: [{ kind: 'strong', code: 'H0428' }],
          stepTokenIds: [1],
        },
      ],
    })
    const loadInterlinearChapterTokens = jest
      .fn()
      .mockRejectedValue(new ResourceAccessError('TEMPORARY_UNAVAILABLE'))

    await expect(
      loadBibleContentChapter(
        {
          book: 5,
          chapter: 12,
          version: 'DBR',
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
        success: false,
        error: expect.objectContaining({ type: 'RESOURCE_TEMPORARY_UNAVAILABLE' }),
      })
    )
    expect(loadInterlinearChapterTokens).toHaveBeenCalledTimes(1)
    expect(loadInterlinearChapterTokens).toHaveBeenCalledWith('BHG', 'fr', 5, 12)
  })

  it('preserves a BHG chapter failure instead of producing an empty reverse interlinear', async () => {
    const dependencies = createDependencies()
    dependencies.chapterAdapter.loadChapter
      .mockResolvedValueOnce({
        status: 'available',
        verses: [{ Livre: 5, Chapitre: 12, Verset: 1, Texte: 'Voici' }],
      })
      .mockResolvedValueOnce({
        status: 'unavailable',
        reason: 'temporary-unavailable',
      })

    const result = await loadBibleContentChapter(
      {
        book: 5,
        chapter: 12,
        version: 'LSG',
        strongMode: 'reverse-interlinear',
        interlinearLocale: 'fr',
      },
      {
        ...dependencies,
        loadReverseInterlinearChapterSpans: jest.fn().mockResolvedValue({ 1: [] }),
        loadInterlinearChapterTokens: jest.fn().mockResolvedValue({ 1: [] }),
      }
    )

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'RESOURCE_TEMPORARY_UNAVAILABLE' }),
      })
    )
  })

  it('uses the configured Strong access for an online reverse interlinear chapter', async () => {
    const chapterAdapter: BibleChapterAdapter = {
      loadChapter: jest.fn(async version => ({
        status: 'available' as const,
        presentation: 'canonical' as const,
        verses: [
          {
            Livre: 1,
            Chapitre: 1,
            Verset: 1,
            Texte: version === 'BHG' ? 'בְּרֵאשִׁית' : 'Au commencement',
          },
        ],
      })),
      loadCoverage: jest.fn(),
    }
    const loadChapterSpans = jest.fn().mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: false },
      spansByVerse: {
        1: [
          {
            ordinal: 0,
            startOffset: 3,
            length: 12,
            identities: [{ kind: 'strong', code: 'H7225' }],
            stepTokenIds: [1],
          },
        ],
      },
    })
    const loadChapterTokens = jest.fn().mockResolvedValue({
      tokensByVerse: {
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
      },
    })
    const access = createBibleContentAccess(
      chapterAdapter,
      { loadChapterSpans },
      { getAvailability: jest.fn(), loadChapterTokens }
    )

    await expect(
      access.loadChapter({
        book: 1,
        chapter: 1,
        version: 'LSG',
        strongMode: 'reverse-interlinear',
        interlinearLocale: 'fr',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ kind: 'reverse-interlinear' }),
      })
    )
    expect(loadChapterSpans).toHaveBeenCalledWith({
      currentVersionId: 'LSG',
      defaultVersionId: 'LSG',
      fallbackVersionIds: [],
      book: 1,
      chapter: 1,
    })
  })

  it('does not apply online reverse interlinear spans from another text revision', async () => {
    const chapterAdapter: BibleChapterAdapter = {
      loadChapter: jest.fn(async version => ({
        status: 'available' as const,
        presentation: 'canonical' as const,
        textRevision: version === 'LSG' ? 'lsg-current' : 'bhg-current',
        textSha256: version === 'LSG' ? '1'.repeat(64) : '2'.repeat(64),
        verses: [
          {
            Livre: 1,
            Chapitre: 1,
            Verset: 1,
            Texte: version === 'BHG' ? 'בְּרֵאשִׁית' : 'Au commencement',
          },
        ],
      })),
      loadCoverage: jest.fn(),
    }
    const access = createBibleContentAccess(
      chapterAdapter,
      {
        loadChapterSpans: jest.fn().mockResolvedValue({
          status: 'available',
          provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: false },
          textRevision: 'lsg-stale',
          textSha256: '0'.repeat(64),
          spansByVerse: { 1: [] },
        }),
      },
      {
        getAvailability: jest.fn(),
        loadChapterTokens: jest.fn().mockResolvedValue({ tokensByVerse: {} }),
      }
    )

    await expect(
      access.loadChapter({
        book: 1,
        chapter: 1,
        version: 'LSG',
        strongMode: 'reverse-interlinear',
        interlinearLocale: 'fr',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ type: 'RESOURCE_INTEGRITY_ERROR' }),
      })
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

  it('maps a temporary source failure to retry instead of a download action', async () => {
    const dependencies = createDependencies()
    const loadChapter = dependencies.chapterAdapter.loadChapter as jest.MockedFunction<
      BibleChapterAdapter['loadChapter']
    >
    loadChapter.mockResolvedValue({
      status: 'unavailable',
      reason: 'temporary-unavailable',
    })

    await expect(
      loadBibleContentChapter({ book: 1, chapter: 1, version: 'LSG' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          type: 'RESOURCE_TEMPORARY_UNAVAILABLE',
          recoveries: ['retry'],
        }),
      })
    )
  })

  it('preserves HTTP diagnostics when coverage loading fails', async () => {
    const chapterAdapter: BibleChapterAdapter = {
      loadChapter: jest.fn(),
      loadCoverage: jest.fn().mockResolvedValue({
        status: 'unavailable',
        reason: 'temporary-unavailable',
        diagnostics: {
          httpStatus: 429,
          requestId: 'coverage-request',
          retryAfterSeconds: 60,
          serverCode: 'RESOURCE_RATE_LIMITED',
        },
      }),
    }
    const access = createBibleContentAccess(chapterAdapter)

    await expect(access.loadCoverage('LSG')).rejects.toMatchObject({
      code: 'TEMPORARY_UNAVAILABLE',
      httpStatus: 429,
      requestId: 'coverage-request',
      retryAfterSeconds: 60,
      serverCode: 'RESOURCE_RATE_LIMITED',
    })
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
