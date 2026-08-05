import { createHash } from 'node:crypto'

export const SUPPORTED_LANGUAGES = ['fr', 'en']

export const BIBLE_PROJECT_ATTRIBUTION = {
  label: 'BibleProject',
  url: 'https://bibleproject.com/',
  termsUrl: 'https://bibleproject.com/terms/',
}

const BOOK_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5,
  48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6,
  4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
]

const compareText = (left, right) => left.localeCompare(right, 'en')

const uniqueSorted = values => [...new Set(values)].sort(compareText)

const compactEdition = edition => ({
  id: edition.id,
  language: edition.language,
  provider: edition.provider,
  providerId: edition.providerId,
  sourceUrl: edition.sourceUrl,
  title: edition.title,
  thumbnailUrl: edition.thumbnailUrl,
  durationSeconds: edition.durationSeconds,
  publishedAt: edition.publishedAt,
  captionsAvailable: Boolean(edition.captionsAvailable),
})

const compactAnchor = anchor => ({
  kind: anchor.kind,
  ...(anchor.testament ? { testament: anchor.testament } : {}),
  ...(anchor.book ? { book: anchor.book } : {}),
  ...(anchor.chapterStart ? { chapterStart: anchor.chapterStart } : {}),
  ...(anchor.verseStart ? { verseStart: anchor.verseStart } : {}),
  ...(anchor.chapterEnd ? { chapterEnd: anchor.chapterEnd } : {}),
  ...(anchor.verseEnd ? { verseEnd: anchor.verseEnd } : {}),
  ...(anchor.code ? { code: anchor.code } : {}),
  ...(anchor.language ? { language: anchor.language } : {}),
  ...(anchor.lemma ? { lemma: anchor.lemma } : {}),
  ...(anchor.transliteration ? { transliteration: anchor.transliteration } : {}),
  ...(anchor.relationship ? { relationship: anchor.relationship } : {}),
  placement: anchor.placement,
  relevance: anchor.relevance,
})

const compactWork = work => ({
  id: work.id,
  categories: [work.category],
  ...(work.series ? { series: work.series } : {}),
  ...(work.sourceUrl ? { sourceUrl: work.sourceUrl } : {}),
  ...(work.strongBinding ? { strongBinding: work.strongBinding } : {}),
  editions: Object.fromEntries(
    work.editions
      .map(compactEdition)
      .sort(
        (left, right) =>
          SUPPORTED_LANGUAGES.indexOf(left.language) - SUPPORTED_LANGUAGES.indexOf(right.language)
      )
      .map(edition => [edition.language, edition])
  ),
  anchors: work.anchors.map(compactAnchor),
})

const chapterKey = (book, chapter) => `${book}:${chapter}`

const chaptersForAnchor = anchor => {
  if (anchor.kind === 'book') {
    if (anchor.placement === 'introduction') return [chapterKey(anchor.book, 1)]
    if (anchor.placement !== 'related-resource') return []
    return Array.from({ length: BOOK_CHAPTER_COUNTS[anchor.book - 1] }, (_, index) =>
      chapterKey(anchor.book, index + 1)
    )
  }
  if (anchor.kind !== 'passage') return []
  if (anchor.placement === 'introduction') return [chapterKey(anchor.book, anchor.chapterStart)]
  if (anchor.placement === 'after-range') return [chapterKey(anchor.book, anchor.chapterEnd)]
  if (!['chapter-resources', 'related-resource'].includes(anchor.placement)) return []
  return Array.from({ length: anchor.chapterEnd - anchor.chapterStart + 1 }, (_, index) =>
    chapterKey(anchor.book, anchor.chapterStart + index)
  )
}

const compareChapterKeys = (left, right) => {
  const [leftBook, leftChapter] = left.split(':').map(Number)
  const [rightBook, rightChapter] = right.split(':').map(Number)
  return leftBook - rightBook || leftChapter - rightChapter
}

const buildIndexes = works => {
  const chapters = new Map()
  const strongs = new Map()
  const library = []
  for (const work of works) {
    for (const anchor of work.anchors) {
      for (const key of chaptersForAnchor(anchor)) {
        chapters.set(key, [...(chapters.get(key) || []), work.id])
      }
      if (anchor.kind === 'strong') {
        strongs.set(anchor.code, [...(strongs.get(anchor.code) || []), work.id])
      }
      if (anchor.kind === 'library') library.push(work.id)
    }
  }
  return {
    chapters: Object.fromEntries(
      [...chapters.entries()]
        .sort(([left], [right]) => compareChapterKeys(left, right))
        .map(([key, ids]) => [key, uniqueSorted(ids)])
    ),
    strongs: Object.fromEntries(
      [...strongs.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, ids]) => [key, uniqueSorted(ids)])
    ),
    library: uniqueSorted(library),
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

export const validateSources = ({ manifests, catalog }) => {
  const sourceWorks = manifests.flatMap(manifest => manifest.works)
  const ids = sourceWorks.map(work => work.id)
  assert(new Set(ids).size === ids.length, 'A concrete work is owned by more than one manifest')
  assert(
    sourceWorks.every(work => work.reviewStatus === 'reviewed'),
    'Every work must be reviewed'
  )
  assert(
    sourceWorks.every(work => work.anchors.every(anchor => anchor.reviewStatus === 'reviewed')),
    'Every anchor must be reviewed'
  )
  const editions = sourceWorks.flatMap(work => work.editions)
  assert(
    sourceWorks.every(
      work => new Set(work.editions.map(edition => edition.language)).size === work.editions.length
    ),
    'A work has more than one edition for the same language'
  )
  assert(
    editions.every(edition => SUPPORTED_LANGUAGES.includes(edition.language)),
    'Only French and English editions are supported'
  )
  assert(
    editions.every(edition => edition.provider === 'youtube'),
    'Every edition must use the YouTube provider'
  )
  assert(
    new Set(editions.map(edition => edition.providerId)).size === editions.length,
    'A YouTube video is published by more than one work'
  )
  const catalogById = new Map(catalog.videos.map(video => [video.id, video]))
  const unsupported = editions.filter(edition => {
    const video = catalogById.get(edition.providerId)
    return !video || !video.aspectRatio || video.isVertical9By16
  })
  assert(
    unsupported.length === 0,
    `Published editions contain missing or vertical videos: ${unsupported.map(item => item.providerId).join(', ')}`
  )
  for (const work of sourceWorks) {
    for (const anchor of work.anchors) {
      if (!['book', 'passage'].includes(anchor.kind)) continue
      assert(
        Number.isInteger(anchor.book) &&
          anchor.book >= 1 &&
          anchor.book <= BOOK_CHAPTER_COUNTS.length,
        `Invalid book number on ${work.id}`
      )
      if (anchor.kind === 'book') continue
      const chapterCount = BOOK_CHAPTER_COUNTS[anchor.book - 1]
      assert(
        Number.isInteger(anchor.chapterStart) &&
          Number.isInteger(anchor.chapterEnd) &&
          anchor.chapterStart >= 1 &&
          anchor.chapterEnd >= anchor.chapterStart &&
          anchor.chapterEnd <= chapterCount,
        `Invalid chapter range on ${work.id}`
      )
    }
  }
}

export const buildPassageMediaPack = ({ manifests, sharedWorkReferences = [], generatedAt }) => {
  const worksById = new Map()
  for (const sourceWork of manifests.flatMap(manifest => manifest.works)) {
    worksById.set(sourceWork.id, compactWork(sourceWork))
  }
  for (const projection of sharedWorkReferences) {
    const work = worksById.get(projection.id)
    assert(work, `Projection word-study references unknown work ${projection.id}`)
    work.categories.push('word-study')
    work.categories = uniqueSorted(work.categories)
    work.series = projection.series
    work.strongBinding = projection.strongBinding
  }
  const works = [...worksById.values()].sort((left, right) => compareText(left.id, right.id))
  const payload = {
    schemaVersion: 1,
    generatedAt,
    languages: SUPPORTED_LANGUAGES,
    languagePolicy: 'strict-route-language-no-fallback',
    access: 'free',
    attribution: BIBLE_PROJECT_ATTRIBUTION,
    works,
    indexes: buildIndexes(works),
  }
  const revision = `sha256:${sha256(JSON.stringify(payload))}`
  return { ...payload, revision }
}

export const sha256 = value => createHash('sha256').update(value).digest('hex')

export const editionForLanguage = (work, language) => work.editions[language]
