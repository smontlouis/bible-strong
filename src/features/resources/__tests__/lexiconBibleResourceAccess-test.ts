import {
  createBhgStrongSpans,
  createLexiconBibleResourceAccess,
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
  localStrongBibleResourceAccess: { loadVerse: jest.fn(), loadChapterCodes: jest.fn() },
}))

const createDependencies = () => ({
  strongBible: {
    getAvailability: jest.fn(),
    loadChapterCodes: jest.fn(),
    loadVerse: jest.fn(),
    loadCountsByBook: jest.fn(),
    loadFoundVersesByBook: jest.fn(),
    loadLemmaStats: jest.fn(),
  },
  interlinear: {
    getInterlinearAvailability: jest.fn(),
    loadVerse: jest.fn(),
    loadCountsByBook: jest.fn(),
    loadFoundVersesByBook: jest.fn(),
  },
})

describe('lexiconBibleResourceAccess', () => {
  it('uses the installed BHG interlinear index before regular Strong Bibles', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.interlinear.loadVerse.mockResolvedValue({
      text: 'בְּרֵאשִׁית',
      tokens: [
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
      ],
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
            morphologies: [
              {
                identity: { kind: 'dstrong', code: 'H07225A' },
                codes: ['HNcfsa'],
              },
            ],
          },
        ],
      },
    })
    expect(dependencies.strongBible.loadVerse).not.toHaveBeenCalled()
  })

  it('does not substitute another BHG locale for the requested locale', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability
      .mockResolvedValueOnce({ status: 'missing' })
      .mockResolvedValueOnce({
        status: 'available',
        locale: 'en',
        textRevision: 'bhg-test',
      })
    dependencies.interlinear.loadVerse.mockResolvedValue({
      text: 'λόγος',
      tokens: [
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
      ],
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'BHG',
      defaultVersionId: 'KJV',
      preferredInterlinearLocale: 'fr',
      book: 43,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual({
      status: 'unavailable',
      attempts: [{ locale: 'fr', status: 'missing' }],
    })
    expect(dependencies.interlinear.getInterlinearAvailability).toHaveBeenCalledTimes(1)
    expect(dependencies.interlinear.loadVerse).not.toHaveBeenCalled()
    expect(dependencies.strongBible.loadVerse).not.toHaveBeenCalled()
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
    expect(dependencies.interlinear.getInterlinearAvailability).toHaveBeenCalled()
    expect(dependencies.strongBible.loadVerse).toHaveBeenCalled()
  })

  it('adds aligned STEP identities to a regular Strong verse', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    ;(dependencies.strongBible.loadVerse as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: false },
      verse: {
        Livre: 2,
        Chapitre: 1,
        Verset: 1,
        Texte: 'Voici',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 5,
            stepTokenIds: [20615],
            identities: [{ kind: 'strong', code: 'H0428' }],
          },
        ],
      },
    })
    dependencies.interlinear.loadVerse.mockResolvedValue({
      text: 'אֵלֶּה',
      tokens: [
        {
          id: 20615,
          ordinal: 0,
          startOffset: 0,
          length: 5,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 5,
              transliteration: 'elleh',
              lemma: 'אֵלֶּה',
              morphology: 'H:DemP',
              gloss: 'voici',
              identities: [
                { kind: 'strong', code: 'H0428' },
                { kind: 'strong', code: 'H9002' },
              ],
            },
          ],
        },
      ],
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    const result = await access.loadVerse({
      currentVersionId: 'LSG',
      defaultVersionId: 'LSG',
      preferredInterlinearLocale: 'fr',
      book: 2,
      chapter: 1,
      verse: 1,
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'available',
        verse: expect.objectContaining({
          StrongSpans: [
            expect.objectContaining({
              identities: [
                { kind: 'strong', code: 'H0428' },
                { kind: 'strong', code: 'H9002' },
              ],
            }),
          ],
        }),
      })
    )
  })

  it('does not substitute a Strong Bible when the requested BHG index is unavailable', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({ status: 'missing' })
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

    expect(result).toEqual({
      status: 'unavailable',
      attempts: [{ locale: 'fr', status: 'missing' }],
    })
    expect(dependencies.strongBible.loadVerse).not.toHaveBeenCalled()
  })

  it('propagates a BHG index read failure without substituting a Strong Bible', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.interlinear.loadVerse.mockRejectedValue(new Error('Unreadable sidecar'))
    ;(dependencies.strongBible.loadVerse as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: true },
      verse: { Livre: 43, Chapitre: 1, Verset: 1, Texte: 'La parole 3056' },
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    await expect(
      access.loadVerse({
        currentVersionId: 'BHG',
        defaultVersionId: 'LSG',
        preferredInterlinearLocale: 'fr',
        book: 43,
        chapter: 1,
        verse: 1,
      })
    ).rejects.toThrow('Unreadable sidecar')
    expect(dependencies.strongBible.loadVerse).not.toHaveBeenCalled()
  })

  it('treats an existing BHG verse without lexical spans as an integrity failure', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.interlinear.loadVerse.mockResolvedValue({
      text: 'בְּרֵאשִׁית',
      tokens: [],
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    await expect(
      access.loadVerse({
        currentVersionId: 'BHG',
        defaultVersionId: 'LSG',
        preferredInterlinearLocale: 'fr',
        book: 1,
        chapter: 1,
        verse: 1,
      })
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' })
  })

  it('loads a BHG concordance page with an opaque domain page token', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.interlinear.loadFoundVersesByBook.mockResolvedValue({
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
              morphologies: [
                {
                  identity: { kind: 'strong', code: 'G03056' },
                  codes: ['N-NSM'],
                },
              ],
            },
          ],
        },
      ],
      nextCursor: 'bhg:26046',
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
              morphologies: [
                {
                  identity: { kind: 'strong', code: 'G03056' },
                  codes: ['N-NSM'],
                },
              ],
            },
          ],
        },
      ],
      nextPageToken: 'interlinear:bhg:26046',
    })
    expect(dependencies.interlinear.loadFoundVersesByBook).toHaveBeenCalledWith(
      'fr',
      expect.objectContaining({ reference: 'G03056', allBooks: true, limit: 60 })
    )
  })

  it('does not mix a Strong fallback into an interlinear continuation failure', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.interlinear.loadFoundVersesByBook.mockRejectedValue(
      new Error('Unreadable V5 index')
    )
    ;(dependencies.strongBible.loadFoundVersesByBook as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: true },
      verses: [],
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    await expect(
      access.loadFoundVersesByBook({
        currentVersionId: 'BHG',
        defaultVersionId: 'LSG',
        preferredInterlinearLocale: 'fr',
        book: 40,
        reference: 'G03056',
        allBooks: true,
        limit: 60,
        pageToken: 'interlinear:bhg:26046',
      })
    ).rejects.toThrow('Unreadable V5 index')
    expect(dependencies.strongBible.loadFoundVersesByBook).not.toHaveBeenCalled()
  })

  it('keeps Strong pagination offsets behind an opaque page token', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'missing',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    const verses = Array.from({ length: 2 }, (_, index) => ({
      Livre: 43,
      Chapitre: 1,
      Verset: index + 1,
      Texte: `Verse ${index + 1}`,
    }))
    ;(dependencies.strongBible.loadFoundVersesByBook as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: false },
      verses,
      nextPageToken: 'strong:v1:1:2:3',
    })
    const access = createLexiconBibleResourceAccess(dependencies)
    const request = {
      currentVersionId: 'LSG' as const,
      defaultVersionId: 'LSG' as const,
      preferredInterlinearLocale: 'fr' as const,
      book: 40,
      reference: 'G03056',
      allBooks: true,
      limit: 2,
    }

    const firstPage = await access.loadFoundVersesByBook(request)
    expect(firstPage).toEqual(expect.objectContaining({ nextPageToken: 'strong:v1:1:2:3' }))

    await access.loadFoundVersesByBook({
      ...request,
      pageToken: firstPage.status === 'available' ? firstPage.nextPageToken : undefined,
    })
    expect(dependencies.strongBible.loadFoundVersesByBook).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageToken: 'strong:v1:1:2:3' })
    )
  })

  it('propagates a BHG count failure without substituting traditional Strong counts', async () => {
    const dependencies = createDependencies()
    dependencies.interlinear.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-test',
    })
    dependencies.interlinear.loadCountsByBook.mockRejectedValue(new Error('Unreadable V5 index'))
    ;(dependencies.strongBible.loadCountsByBook as jest.Mock).mockResolvedValue({
      status: 'available',
      provenance: { versionId: 'LSG', datasetId: 'LSG', isFallback: true },
      counts: [{ Livre: 43, versesCountByBook: 12 }],
    })
    const access = createLexiconBibleResourceAccess(dependencies)

    await expect(
      access.loadCountsByBook({
        currentVersionId: 'BHG',
        defaultVersionId: 'LSG',
        preferredInterlinearLocale: 'fr',
        book: 40,
        reference: 'G03056',
        allBooks: true,
      })
    ).rejects.toThrow('Unreadable V5 index')
    expect(dependencies.strongBible.loadCountsByBook).not.toHaveBeenCalled()
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
        morphologies: [
          { identity: { kind: 'dstrong', code: 'H0001A' }, codes: ['HNcmsa'] },
          { identity: { kind: 'strong', code: 'H0002' }, codes: ['HNcmsa'] },
        ],
      },
    ])
  })
})
