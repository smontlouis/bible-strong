import type { PassageMediaCatalog } from '../passageMedia'
import {
  formatPassageMediaDuration,
  getPassageMediaForChapter,
  getPassageMediaEmbedUrl,
  resolvePassageMediaChapter,
  resolvePassageMediaLibrary,
  resolvePassageMediaStrong,
} from '../passageMedia'

const catalog: PassageMediaCatalog = {
  attribution: {
    label: 'BibleProject test',
    url: 'https://bibleproject.test/',
    termsUrl: 'https://bibleproject.test/terms/',
  },
  works: [
    {
      id: 'reading-library',
      categories: ['how-to-read'],
      editions: {
        fr: {
          id: 'reading-library:fr',
          language: 'fr',
          provider: 'youtube',
          providerId: 'reading-library-fr',
          sourceUrl: 'https://www.youtube.com/watch?v=reading-library-fr',
          title: 'Comment lire la Bible',
          thumbnailUrl: 'https://img.test/reading-library.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 420,
        },
      },
      anchors: [
        {
          kind: 'library',
          placement: 'library',
          relevance: 'primary',
        },
      ],
    },
    {
      id: 'genesis-overview',
      editions: {
        fr: {
          id: 'genesis-overview:fr',
          language: 'fr',
          provider: 'youtube',
          providerId: 'intro-fr',
          sourceUrl: 'https://www.youtube.com/watch?v=intro-fr',
          title: 'Introduction à la Genèse',
          thumbnailUrl: 'https://img.test/intro.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 120,
        },
      },
      anchors: [
        {
          kind: 'book',
          book: 1,
          placement: 'introduction',
          relevance: 'primary',
        },
      ],
    },
    {
      id: 'creation',
      editions: {
        fr: {
          id: 'creation:fr',
          language: 'fr',
          provider: 'youtube',
          providerId: 'creation-fr',
          sourceUrl: 'https://www.youtube.com/watch?v=creation-fr',
          title: 'La création',
          thumbnailUrl: 'https://img.test/creation.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 180,
        },
      },
      anchors: [
        {
          kind: 'passage',
          book: 1,
          chapterStart: 1,
          verseStart: 1,
          chapterEnd: 1,
          verseEnd: 3,
          placement: 'after-range',
          relevance: 'primary',
        },
        {
          kind: 'passage',
          book: 1,
          chapterStart: 1,
          verseStart: 4,
          chapterEnd: 1,
          verseEnd: 5,
          placement: 'after-range',
          relevance: 'primary',
        },
      ],
    },
    {
      id: 'chapter-context',
      editions: {
        fr: {
          id: 'chapter-context:fr',
          language: 'fr',
          provider: 'youtube',
          providerId: 'context-fr',
          sourceUrl: 'https://www.youtube.com/watch?v=context-fr',
          title: 'Contexte du chapitre',
          thumbnailUrl: 'https://img.test/context.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 240,
        },
      },
      anchors: [
        {
          kind: 'passage',
          book: 1,
          chapterStart: 1,
          chapterEnd: 2,
          placement: 'chapter-resources',
          relevance: 'primary',
        },
      ],
    },
    {
      id: 'related-creation',
      editions: {
        fr: {
          id: 'related-creation:fr',
          language: 'fr',
          provider: 'youtube',
          providerId: 'related-creation-fr',
          sourceUrl: 'https://www.youtube.com/watch?v=related-creation-fr',
          title: 'Thème lié à la création',
          thumbnailUrl: 'https://img.test/related-creation.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 210,
        },
      },
      anchors: [
        {
          kind: 'passage',
          book: 1,
          chapterStart: 1,
          verseStart: 4,
          chapterEnd: 1,
          verseEnd: 5,
          placement: 'related-resource',
          relevance: 'related',
        },
      ],
    },
    {
      id: 'english-only',
      editions: {
        en: {
          id: 'english-only:en',
          language: 'en',
          provider: 'youtube',
          providerId: 'english',
          sourceUrl: 'https://www.youtube.com/watch?v=english',
          title: 'English only',
          thumbnailUrl: 'https://img.test/english.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 60,
        },
      },
      anchors: [
        {
          kind: 'passage',
          book: 1,
          chapterStart: 1,
          chapterEnd: 1,
          placement: 'chapter-resources',
          relevance: 'primary',
        },
      ],
    },
    {
      id: 'agape',
      editions: {
        fr: {
          id: 'agape:fr',
          language: 'fr',
          provider: 'youtube',
          providerId: 'agape-fr',
          sourceUrl: 'https://www.youtube.com/watch?v=agape-fr',
          title: 'Agapè, l’amour',
          thumbnailUrl: 'https://img.test/agape.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 300,
        },
      },
      anchors: [
        {
          kind: 'strong',
          code: 'G0026',
          placement: 'strong-resource',
          relevance: 'primary',
        },
      ],
    },
    {
      id: 'section-overview',
      editions: {
        fr: {
          id: 'section-overview:fr',
          language: 'fr',
          provider: 'youtube',
          providerId: 'section-overview-fr',
          sourceUrl: 'https://www.youtube.com/watch?v=section-overview-fr',
          title: 'Vue d’ensemble de la section',
          thumbnailUrl: 'https://img.test/section-overview.jpg',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          durationSeconds: 300,
        },
      },
      anchors: [
        {
          kind: 'passage',
          book: 1,
          chapterStart: 12,
          chapterEnd: 50,
          placement: 'introduction',
          relevance: 'primary',
        },
      ],
    },
  ],
  indexes: {
    chapters: {
      '1:1': [
        'genesis-overview',
        'creation',
        'chapter-context',
        'related-creation',
        'english-only',
      ],
      '1:2': ['chapter-context'],
    },
    strongs: {
      G0026: ['agape'],
    },
    library: ['reading-library', 'english-only'],
  },
}

describe('resolvePassageMediaChapter', () => {
  it.each([
    ['Job', 18, 1],
    ['Job', 18, 42],
    ['Proverbs', 20, 1],
    ['Proverbs', 20, 31],
    ['Ecclesiastes', 21, 1],
    ['Ecclesiastes', 21, 12],
  ])('adds the wisdom introduction to %s %i:%i', (_bookName, book, chapter) => {
    const result = getPassageMediaForChapter({ book, chapter, language: 'en' })

    expect(result.chapterResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workId: 'associated-resource-86V8VTUVBmo' }),
      ])
    )
  })

  it('keeps a media work biblical scope instead of replacing it with the current chapter', () => {
    const result = getPassageMediaForChapter({ book: 3, chapter: 25, language: 'en' })
    const biblicalLaw = result.introduction.find(
      item => item.workId === 'associated-resource-Sew1kBIe-W0'
    )

    expect(biblicalLaw?.reference).toBe('Exodus–Deuteronomy')
  })

  it('places localized primary and related media at their Bible Viewer positions', () => {
    expect(resolvePassageMediaChapter(catalog, { book: 1, chapter: 1, language: 'fr' })).toEqual({
      introduction: [
        expect.objectContaining({
          workId: 'genesis-overview',
          title: 'Introduction à la Genèse',
          attributionLabel: 'BibleProject test',
          blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
        }),
      ],
      isIntroductionStartChapter: true,
      afterVerses: {
        3: [expect.objectContaining({ workId: 'creation', title: 'La création' })],
        5: [
          expect.objectContaining({ workId: 'creation', title: 'La création' }),
          expect.objectContaining({
            workId: 'related-creation',
            title: 'Thème lié à la création',
          }),
        ],
      },
      chapterResources: [
        expect.objectContaining({ workId: 'chapter-context', title: 'Contexte du chapitre' }),
      ],
    })
  })

  it('marks a section introduction as large only on its first linked chapter', () => {
    const firstChapter = resolvePassageMediaChapter(catalog, {
      book: 1,
      chapter: 12,
      language: 'fr',
    })
    const followingChapter = resolvePassageMediaChapter(catalog, {
      book: 1,
      chapter: 13,
      language: 'fr',
    })

    expect(firstChapter.introduction).toEqual([
      expect.objectContaining({ workId: 'genesis-overview' }),
      expect.objectContaining({ workId: 'section-overview' }),
    ])
    expect(firstChapter.isIntroductionStartChapter).toBe(true)
    expect(followingChapter.isIntroductionStartChapter).toBe(false)
  })
})

describe('formatPassageMediaDuration', () => {
  it('formats minute and hour-long video durations', () => {
    expect(formatPassageMediaDuration(428)).toBe('7:08')
    expect(formatPassageMediaDuration(3723)).toBe('1:02:03')
  })
})

describe('resolvePassageMediaStrong', () => {
  it('resolves a localized Strong resource from a classical or disambiguated code', () => {
    expect(resolvePassageMediaStrong(catalog, { strongCode: 'G0026A', language: 'fr' })).toEqual([
      expect.objectContaining({
        workId: 'agape',
        providerId: 'agape-fr',
        strongCodes: ['G0026'],
      }),
    ])
  })

  it('does not fall back to another edition language', () => {
    expect(resolvePassageMediaStrong(catalog, { strongCode: 'G0026', language: 'en' })).toEqual([])
  })
})

describe('resolvePassageMediaLibrary', () => {
  it('preserves library order and only returns the requested language', () => {
    expect(resolvePassageMediaLibrary(catalog, { language: 'fr' })).toEqual([
      expect.objectContaining({
        workId: 'reading-library',
        title: 'Comment lire la Bible',
        categories: ['how-to-read'],
      }),
    ])
  })
})

describe('getPassageMediaEmbedUrl', () => {
  it('creates an inline autoplay YouTube embed URL', () => {
    expect(getPassageMediaEmbedUrl('video/id')).toBe(
      'https://www.youtube.com/embed/video%2Fid?autoplay=1&playsinline=1&rel=0&modestbranding=1'
    )
  })
})
