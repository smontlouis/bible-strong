import {
  createBhgStrongSpans,
  createLexiconBibleResourceAccess,
  type LexiconBibleResourceDependencies,
} from '../lexiconBibleResourceAccess'

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

jest.mock('~helpers/biblesDb', () => ({
  getMultipleVerses: jest.fn(),
  getVerseText: jest.fn(),
}))

jest.mock('~helpers/interlinearBibleSidecar', () => ({
  getInterlinearSidecarAvailability: jest.fn(),
  loadInterlinearVerseTokens: jest.fn(),
  loadInterlinearStrongOccurrencePage: jest.fn(),
  loadInterlinearStrongVerseCountsByBook: jest.fn(),
}))

jest.mock('~features/resources/strongBibleResourceAccess', () => ({
  localStrongBibleResourceAccess: { loadVerse: jest.fn() },
}))

const createDependencies = (): jest.Mocked<LexiconBibleResourceDependencies> => ({
  strongBible: {
    loadVerse: jest.fn(),
    loadCountsByBook: jest.fn(),
    loadFoundVersesByBook: jest.fn(),
    loadLemmaStats: jest.fn(),
  },
  getInterlinearAvailability: jest.fn(),
  loadInterlinearVerseTokens: jest.fn(),
  loadInterlinearStrongOccurrencePage: jest.fn(),
  loadInterlinearStrongVerseCountsByBook: jest.fn(),
  getMultipleVerses: jest.fn(),
  getVerseText: jest.fn(),
})

describe('lexiconBibleResourceAccess', () => {
  it('uses the installed BHG interlinear index before regular Strong Bibles', async () => {
    const dependencies = createDependencies()
    dependencies.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.getVerseText.mockResolvedValue('בְּרֵאשִׁית')
    dependencies.loadInterlinearVerseTokens.mockResolvedValue([
      {
        ordinal: 0,
        startOffset: 0,
        length: 10,
        segments: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 10,
            transliteration: 're.Shit',
            lemma: 'רֵאשִׁית',
            morphology: 'HNcfsa',
            gloss: 'commencement',
            identities: [
              { kind: 'strong', code: 'H07225' },
              { kind: 'dstrong', code: 'H07225A' },
            ],
          },
        ],
      },
    ])
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BHG',
      defaultVersionId: 'LSG',
      preferredInterlinearLocale: 'fr',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual({
      status: 'available',
      provenance: {
        sourceKind: 'interlinear',
        versionId: 'BHG',
        datasetId: 'STEP',
        locale: 'fr',
        isFallback: false,
      },
      verse: {
        Livre: 1,
        Chapitre: 1,
        Verset: 1,
        Texte: 'בְּרֵאשִׁית',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 10,
            identities: [{ kind: 'dstrong', code: 'H07225A' }],
          },
        ],
      },
    })
    expect(dependencies.strongBible.loadVerse).not.toHaveBeenCalled()
  })

  it('falls back to the other installed BHG locale', async () => {
    const dependencies = createDependencies()
    dependencies.getInterlinearAvailability
      .mockResolvedValueOnce({ status: 'missing' })
      .mockResolvedValueOnce({
        status: 'available',
        locale: 'en',
        textRevision: 'bhg-test',
      })
    dependencies.getVerseText.mockResolvedValue('λόγος')
    dependencies.loadInterlinearVerseTokens.mockResolvedValue([
      {
        ordinal: 0,
        startOffset: 0,
        length: 5,
        segments: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 5,
            transliteration: 'logos',
            lemma: 'λόγος',
            morphology: 'N-NSM',
            gloss: 'word',
            identities: [{ kind: 'strong', code: 'G03056' }],
          },
        ],
      },
    ])
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BHG',
      defaultVersionId: 'KJV',
      preferredInterlinearLocale: 'fr',
      book: 43,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        provenance: expect.objectContaining({ versionId: 'BHG', locale: 'en' }),
      })
    )
    expect(dependencies.loadInterlinearVerseTokens).toHaveBeenCalledWith('BHG', 'en', 43, 1, 1)
  })

  it('respects a manual Strong Bible source instead of BHG', async () => {
    const dependencies = createDependencies()
    ;(dependencies.strongBible.loadVerse as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'DBY', datasetId: 'DBY', isFallback: true },
      verse: { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'Au commencement 7225' },
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BHG',
      defaultVersionId: 'LSG',
      preferredVersionId: 'DBY',
      preferredInterlinearLocale: 'fr',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(expect.objectContaining({ status: 'available' }))
    expect(dependencies.getInterlinearAvailability).not.toHaveBeenCalled()
    expect(dependencies.strongBible.loadVerse).toHaveBeenCalled()
  })

  it('falls back to regular Strong Bibles when no BHG index is installed', async () => {
    const dependencies = createDependencies()
    dependencies.getInterlinearAvailability.mockResolvedValue({ status: 'missing' })
    ;(dependencies.strongBible.loadVerse as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: true },
      verse: { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'Au commencement 7225' },
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BHG',
      defaultVersionId: 'LSG',
      preferredInterlinearLocale: 'fr',
      book: 1,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        provenance: expect.objectContaining({ versionId: 'LSG' }),
      })
    )
  })

  it('falls back to regular Strong Bibles when an installed BHG index cannot be read', async () => {
    const dependencies = createDependencies()
    dependencies.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.getVerseText.mockResolvedValue('λόγος')
    dependencies.loadInterlinearVerseTokens.mockRejectedValue(new Error('Unreadable sidecar'))
    ;(dependencies.strongBible.loadVerse as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: true },
      verse: { Livre: 43, Chapitre: 1, Verset: 1, Texte: 'La parole 3056' },
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BHG',
      defaultVersionId: 'LSG',
      preferredInterlinearLocale: 'fr',
      book: 43,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        provenance: expect.objectContaining({ versionId: 'LSG' }),
      })
    )
  })

  it('loads a BHG concordance page from the verse index without exposing storage ids', async () => {
    const dependencies = createDependencies()
    dependencies.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.loadInterlinearStrongOccurrencePage.mockResolvedValue({
      occurrences: [
        {
          Livre: 43,
          Chapitre: 1,
          Verset: 1,
          tokens: [
            {
              ordinal: 5,
              startOffset: 14,
              length: 5,
              segments: [
                {
                  ordinal: 0,
                  startOffset: 0,
                  length: 5,
                  transliteration: 'logos',
                  lemma: 'λόγος',
                  morphology: 'N-NSM',
                  gloss: 'parole',
                  identities: [{ kind: 'strong', code: 'G03056' }],
                },
              ],
            },
          ],
        },
      ],
      nextCursor: 'bhg:26046',
    })
    dependencies.getMultipleVerses.mockResolvedValue({ '43-1-1': 'Ἐν ἀρχῇ ἦν ὁ λόγος' })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadFoundVersesByBook({
      currentVersionId: 'BHG',
      defaultVersionId: 'LSG',
      preferredInterlinearLocale: 'fr',
      book: 40,
      reference: 'G03056',
      allBooks: true,
      limit: 60,
      offset: 0,
    })

    expect(result).toEqual({
      status: 'available',
      provenance: expect.objectContaining({ versionId: 'BHG', locale: 'fr' }),
      verses: [
        {
          Livre: 43,
          Chapitre: 1,
          Verset: 1,
          Texte: 'Ἐν ἀρχῇ ἦν ὁ λόγος',
          StrongSpans: [
            {
              ordinal: 5,
              startOffset: 14,
              length: 5,
              identities: [{ kind: 'strong', code: 'G03056' }],
            },
          ],
        },
      ],
      nextCursor: 'bhg:26046',
    })
    expect(dependencies.loadInterlinearStrongOccurrencePage).toHaveBeenCalledWith('fr', 'G03056', {
      book: undefined,
      limit: 60,
      cursor: undefined,
    })
  })

  it('falls back to a traditional Strong Bible when the BHG concordance cannot be read', async () => {
    const dependencies = createDependencies()
    dependencies.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.loadInterlinearStrongOccurrencePage.mockRejectedValue(
      new Error('Unreadable V5 index')
    )
    ;(dependencies.strongBible.loadFoundVersesByBook as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: true },
      verses: [],
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadFoundVersesByBook({
      currentVersionId: 'BHG',
      defaultVersionId: 'LSG',
      preferredInterlinearLocale: 'fr',
      book: 40,
      reference: 'G03056',
      allBooks: true,
      limit: 60,
      offset: 60,
      cursor: 'bhg:26046',
    })

    expect(result).toEqual(
      expect.objectContaining({
        provenance: expect.objectContaining({ versionId: 'LSG' }),
      })
    )
    expect(dependencies.strongBible.loadFoundVersesByBook).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 60 })
    )
  })

  it('falls back to traditional Strong counts when the BHG verse index cannot be read', async () => {
    const dependencies = createDependencies()
    dependencies.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.loadInterlinearStrongVerseCountsByBook.mockRejectedValue(
      new Error('Unreadable V5 index')
    )
    ;(dependencies.strongBible.loadCountsByBook as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: true },
      counts: [{ Livre: 43, versesCountByBook: 12 }],
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadCountsByBook({
      currentVersionId: 'BHG',
      defaultVersionId: 'LSG',
      preferredInterlinearLocale: 'fr',
      book: 40,
      reference: 'G03056',
      allBooks: true,
    })

    expect(result).toEqual(
      expect.objectContaining({
        provenance: expect.objectContaining({ versionId: 'LSG' }),
      })
    )
  })
})

describe('createBhgStrongSpans', () => {
  it('keeps D and S identities while hiding S when D has the same number', () => {
    expect(
      createBhgStrongSpans([
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 4,
              transliteration: 'abba',
              lemma: 'אַבָּא',
              morphology: 'HNcmsa',
              gloss: 'père',
              identities: [
                { kind: 'strong', code: 'H0001' },
                { kind: 'dstrong', code: 'H0001A' },
                { kind: 'strong', code: 'H0002' },
              ],
            },
          ],
        },
      ])
    ).toEqual([
      {
        ordinal: 0,
        startOffset: 0,
        length: 4,
        identities: [
          { kind: 'dstrong', code: 'H0001A' },
          { kind: 'strong', code: 'H0002' },
        ],
      },
    ])
  })
})
