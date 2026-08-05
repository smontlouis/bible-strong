import type { PassageMediaCatalog } from '../passageMedia'
import {
  formatPassageMediaDuration,
  getPassageMediaEmbedUrl,
  resolvePassageMediaChapter,
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
  },
}

describe('resolvePassageMediaChapter', () => {
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

describe('getPassageMediaEmbedUrl', () => {
  it('creates an inline autoplay YouTube embed URL', () => {
    expect(getPassageMediaEmbedUrl('video/id')).toBe(
      'https://www.youtube.com/embed/video%2Fid?autoplay=1&playsinline=1&rel=0&modestbranding=1'
    )
  })
})
