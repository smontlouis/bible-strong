import { createHash } from 'node:crypto'

export const SDABC_ITEM = 'SdaBibleCommentary1980'
export const SDABC_ITEM_URL = `https://archive.org/details/${SDABC_ITEM}`
export const SDABC_METADATA_URL = `https://archive.org/metadata/${SDABC_ITEM}`
export const SDABC_DOWNLOAD_ROOT = `https://archive.org/download/${SDABC_ITEM}`

export const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Songs',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
]

export const BIBLE_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150,
  31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16,
  24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1,
  1, 22,
]

export const sha256 = value => createHash('sha256').update(value).digest('hex')

export const selectBiblePdfs = metadata => {
  const selected = []
  for (const file of metadata.files ?? []) {
    const match = file.name?.match(/^SdaBc-(\d) \((\d{2})(?:-(\d{2}))?\).*\.pdf$/i)
    if (!match || match[2] === '00') continue
    const firstBook = Number(match[2])
    const lastBook = Number(match[3] ?? match[2])
    if (firstBook < 1 || lastBook > 66) continue
    selected.push({
      volume: Number(match[1]),
      firstBook,
      lastBook,
      name: file.name,
      size: Number(file.size ?? 0),
      url: `${SDABC_DOWNLOAD_ROOT}/${encodeURIComponent(file.name).replaceAll('%2F', '/')}`,
    })
  }
  selected.sort((left, right) => left.firstBook - right.firstBook)
  const covered = new Set(selected.flatMap(file => Array.from(
    { length: file.lastBook - file.firstBook + 1 },
    (_, index) => file.firstBook + index,
  )))
  const missing = BIBLE_BOOKS.map((_, index) => index + 1).filter(book => !covered.has(book))
  if (missing.length) throw new Error(`PDF SDABC manquants pour les livres : ${missing.join(', ')}`)
  return selected
}

const normalizeText = value => String(value ?? '')
  .replaceAll('\r', '')
  .replaceAll('\f', '\n')
  .replace(/[ \t]+$/gm, '')

const markerRegex = /^[ \t]*(?:C[ \t]*HAPTER|PSALM)[ \t]+(\d+)\.?[ \t]*(?=$|INTRODUCTION)/gim

export const splitBookChapters = ({ text, chapterCount }) => {
  const normalized = normalizeText(text)
  const markers = [...normalized.matchAll(markerRegex)]
    .map(match => ({ chapter: Number(match[1]), index: match.index, end: match.index + match[0].length }))
    .filter(marker => marker.chapter >= 1 && marker.chapter <= chapterCount)

  const unique = []
  for (const marker of markers) {
    if (unique.some(item => item.chapter === marker.chapter)) continue
    unique.push(marker)
  }
  unique.sort((left, right) => left.index - right.index)

  if (chapterCount === 1 && unique.length === 0) {
    return [{ chapter: 1, text: normalized, introduction: normalized.slice(0, findSingleChapterCommentaryStart(normalized)) }]
  }
  if (unique.length !== chapterCount) {
    throw new Error(`${chapterCount} chapitres attendus, ${unique.length} titres trouvés`)
  }
  return unique.map((marker, index) => ({
    chapter: marker.chapter,
    text: normalized.slice(marker.end, unique[index + 1]?.index ?? normalized.length),
    introduction: marker.chapter === 1 ? normalized.slice(0, marker.index) : '',
  }))
}

const headingRegex = /^( {0,16})(\d{1,3}(?:\s*(?:[-–—,]|,\s*vs?\.)\s*\d{1,3})*)\.\s+(\S.*)$/gm

const headingAnchor = expression => Number(expression.match(/^\d+/)?.[0])
const headingEnd = expression => {
  const range = expression.match(/^\s*\d+\s*[-–—]\s*(\d+)\s*$/)
  return range ? Number(range[1]) : headingAnchor(expression)
}

const findSingleChapterCommentaryStart = text => {
  const outline = /\n\s*5\.\s+Outline\./i.exec(text)
  const startAt = outline ? outline.index + outline[0].length : Math.floor(text.length / 5)
  const candidates = [...text.slice(startAt).matchAll(headingRegex)]
  const first = candidates.find(match => headingAnchor(match[2]) === 1)
  return first ? startAt + first.index : startAt
}

const stripSupplement = text => text.split(/^\s*ELLEN G\. WHITE COMMENTS\s*$/im, 1)[0]

const cleanParagraphs = value => {
  const lines = normalizeText(value).split('\n')
  const paragraphs = []
  let current = []
  const flush = () => {
    const text = current.join(' ').replace(/\s+/g, ' ').trim()
    if (text) paragraphs.push(text)
    current = []
  }
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }
    if (/^(?:\d+|Seventh-day Adventist Bible Commentary)$/i.test(line)) continue
    current.push(line)
  }
  flush()
  return paragraphs
}

const escapeHtml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

export const parseBookIntroduction = ({ text, book }) => {
  const paragraphs = cleanParagraphs(text)
  if (!paragraphs.length) return null
  const html = paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')
  return {
    schemaVersion: 1,
    id: `sdabc:${book}-1-0:introduction`,
    passage: `${book}-1-0`,
    passageEndVerse: 0,
    referenceLabel: `${BIBLE_BOOKS[book - 1]} — Introduction`,
    verseExpression: '0',
    source: { language: 'en', html, sha256: sha256(html) },
    translation: null,
    editorialKind: 'book-introduction',
  }
}

export const parseChapterCommentary = ({ text, book, chapter, maxVerse, singleChapterBook = false }) => {
  const withoutSupplement = stripSupplement(text)
  const start = singleChapterBook
    ? findSingleChapterCommentaryStart(withoutSupplement)
    : 0
  const body = withoutSupplement.slice(start)
  const candidates = [...body.matchAll(headingRegex)]
    .map(match => ({
      index: match.index,
      endIndex: match.index + match[0].length,
      indent: match[1].length,
      expression: match[2].replace(/\s+/g, ' ').trim(),
      anchor: headingAnchor(match[2]),
      endVerse: headingEnd(match[2]),
      title: match[3].trim(),
    }))
    .filter(item => item.anchor >= 1 && item.anchor <= maxVerse && item.endVerse <= maxVerse)

  const selected = []
  let expectedMinimum = 1
  for (const [candidateIndex, candidate] of candidates.entries()) {
    if (candidate.anchor < expectedMinimum) continue
    const laterCorrection = candidates.slice(candidateIndex + 1).some(later =>
      later.anchor >= expectedMinimum && later.anchor < candidate.anchor
    )
    if (laterCorrection) continue
    selected.push(candidate)
    expectedMinimum = candidate.endVerse + 1
  }
  if (!selected.length) throw new Error(`Aucun commentaire trouvé pour ${book}-${chapter}`)

  return selected.map((heading, index) => {
    const content = body.slice(heading.endIndex, selected[index + 1]?.index ?? body.length).replace(/^\n/, '')
    const paragraphs = cleanParagraphs(`${heading.title}\n${content}`)
    const html = paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')
    return {
      schemaVersion: 1,
      id: `sdabc:${book}-${chapter}-${heading.anchor}:${index + 1}`,
      passage: `${book}-${chapter}-${heading.anchor}`,
      passageEndVerse: heading.endVerse,
      referenceLabel: `${BIBLE_BOOKS[book - 1]} ${chapter}:${heading.expression}`,
      verseExpression: heading.expression,
      source: { language: 'en', html, sha256: sha256(html) },
      translation: null,
      editorialKind: 'general-commentary',
    }
  })
}

export const splitCombinedJohn = text => {
  const normalized = normalizeText(text)
  const third = /\bThe Third Epistle of\s+JOHN\b/i.exec(normalized)
  if (!third) throw new Error('Séparation entre 2 Jean et 3 Jean introuvable')
  return { 63: normalized.slice(0, third.index), 64: normalized.slice(third.index) }
}
