import type { PassageMediaCatalog } from '../passageMedia'
import { formatPassageMediaDuration, resolvePassageMediaChapter } from '../passageMedia'

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
  ],
  indexes: {
    chapters: {
      '1:1': ['genesis-overview', 'creation', 'chapter-context', 'english-only'],
      '1:2': ['chapter-context'],
    },
  },
}

describe('resolvePassageMediaChapter', () => {
  it('places localized primary media at the introduction, verse range, and chapter footer', () => {
    expect(resolvePassageMediaChapter(catalog, { book: 1, chapter: 1, language: 'fr' })).toEqual({
      introduction: [
        expect.objectContaining({
          workId: 'genesis-overview',
          title: 'Introduction à la Genèse',
          attributionLabel: 'BibleProject test',
        }),
      ],
      afterVerses: {
        3: [expect.objectContaining({ workId: 'creation', title: 'La création' })],
        5: [expect.objectContaining({ workId: 'creation', title: 'La création' })],
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
