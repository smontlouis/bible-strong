const crypto = require('node:crypto')
const { DomUtils, parseDocument } = require('htmlparser2')

const APP_BOOK_IDS = [
  ...Array.from({ length: 39 }, (_, index) => index + 1),
  67,
  68,
  69,
  70,
  71,
  72,
  73,
  74,
  75,
  76,
  77,
]

const SOURCE_SECTIONS = [
  ['genese', 1, 50],
  ['exode', 2, 40],
  ['levitique', 3, 27],
  ['nombres', 4, 36],
  ['deuteronome', 5, 34],
  ['josue', 6, 24],
  ['juges', 7, 21],
  ['ruth', 8, 4],
  ['1rois', 9, 31],
  ['2rois', 10, 24],
  ['3rois', 11, 22],
  ['4rois', 12, 25],
  ['1chroniques', 13, 29],
  ['2chroniques', 14, 36],
  ['1esdras', 74, 9],
  // In the Septuagint, 2 Esdras contains canonical Ezra and Nehemiah.
  ['2esdras', 15, 10],
  ['2esdras', 16, 13, 10],
  ['esther', 17, 10],
  ['job', 18, 42],
  ['psaumes', 19, 151],
  ['proverbes', 20, 31],
  ['ecclesiaste', 21, 12],
  ['cantique', 22, 8],
  ['esaie', 23, 66],
  ['jeremie', 24, 52],
  ['lamentations', 25, 5],
  ['ezechiel', 26, 48],
  ['daniel_theod', 27, 12],
  ['suzanne_theod', 27, 1, 0, 13],
  ['bel_theod', 27, 1, 0, 14],
  ['osee', 28, 14],
  ['joel', 29, 4],
  ['amos', 30, 9],
  ['abdias', 31, 1],
  ['jonas', 32, 4],
  ['michee', 33, 7],
  ['nahum', 34, 3],
  ['habakuk', 35, 3],
  ['sophonie', 36, 3],
  ['aggee', 37, 2],
  ['zacharie', 38, 14],
  ['malachie', 39, 3],
  ['tobie', 67, 14],
  ['judith', 68, 16],
  ['sagesse', 69, 19],
  ['siracide', 70, 52],
  ['baruch', 71, 5],
  ['lettre_jeremie', 71, 1, 0, 6],
  ['1maccabees', 72, 16],
  ['2maccabees', 73, 15],
  ['3maccabees', 75, 7],
  ['4maccabees', 76, 18],
  ['salomon_psaumes', 77, 18],
].map(([slug, book, chapterCount, sourceOffset = 0, targetChapter]) => ({
  slug,
  book,
  chapterCount,
  sourceOffset,
  targetChapter,
}))

const normalizeVerseText = value =>
  value
    .replace(/[\t\r\n \u00a0]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

const nodeText = node => {
  if (node.type === 'text') return node.data
  if (node.name === 'br') return ' '
  return (node.children ?? []).map(nodeText).join('')
}

const findByClass = (root, className) =>
  DomUtils.findOne(
    node => node.type === 'tag' && (node.attribs?.class ?? '').split(/\s+/).includes(className),
    root.children ?? []
  )

const appendVerse = (verses, label, text) => {
  const range = label.trim().match(/^(\d+)-(\d+)$/)
  if (range) {
    const verse = Number(range[1])
    const addition = `(${label.trim()}) ${text}`
    verses[verse] = verses[verse] ? `${verses[verse]} ${addition}` : addition
    return
  }
  const match = label.trim().match(/^(\d+)([a-z]+)?$/i)
  if (!match) throw new Error(`Unsupported verse label: ${label}`)

  const verse = Number(match[1])
  const suffix = match[2]?.toLowerCase()
  const addition = suffix ? `(${suffix}) ${text}` : text
  if (verses[verse]) {
    if (!suffix) throw new Error(`Duplicate numeric verse: ${label}`)
    verses[verse] = `${verses[verse]} ${addition}`
  } else {
    verses[verse] = addition
  }
}

const parseTheotexChapter = html => {
  const document = parseDocument(html, { decodeEntities: true })
  const greekNodes = DomUtils.findAll(
    node => node.type === 'tag' && (node.attribs?.class ?? '').split(/\s+/).includes('vg'),
    document.children
  )
  const greek = {}
  const french = {}

  for (const greekNode of greekNodes) {
    let row = greekNode.parent
    while (row && !(row.type === 'tag' && row.name === 'tr')) row = row.parent
    if (!row) throw new Error('A Greek verse is not contained in a table row')
    const frenchNode = findByClass(row, 'vf')
    if (!frenchNode) throw new Error('A verse row does not contain both Greek and French')

    const numberNode = findByClass(row, 'num')
    if (!numberNode) throw new Error('A verse row does not contain a verse number')
    const label = normalizeVerseText(nodeText(numberNode))
    let greekText = normalizeVerseText(nodeText(greekNode))
    const frenchText = normalizeVerseText(nodeText(frenchNode))
    if (!greekText || !frenchText) throw new Error(`Empty verse text at ${label}`)
    let effectiveLabel = label
    if (/^\d+$/.test(label) && greek[Number(label)]) {
      const inlineSuffix = greekText.match(/^\(?([a-z])\)?\s+(.+)$/i)
      if (!inlineSuffix) {
        greek[Number(label)] = `${greek[Number(label)]} ${greekText}`
        french[Number(label)] = `${french[Number(label)]} ${frenchText}`
        continue
      }
      effectiveLabel = `${label}${inlineSuffix[1]}`
      greekText = inlineSuffix[2]
      const frenchSuffix = frenchText.match(new RegExp(`^\\(?${inlineSuffix[1]}\\)?\\s+(.+)$`, 'i'))
      if (frenchSuffix) {
        appendVerse(greek, effectiveLabel, greekText)
        appendVerse(french, effectiveLabel, frenchSuffix[1])
        continue
      }
    }
    appendVerse(greek, effectiveLabel, greekText)
    appendVerse(french, effectiveLabel, frenchText)
  }

  if (Object.keys(greek).length === 0) throw new Error('No verses found in chapter page')
  return { greek, french }
}

const buildSourcePages = (baseUrl = 'https://theotex.org/septuaginta') =>
  SOURCE_SECTIONS.flatMap(section =>
    Array.from({ length: section.chapterCount }, (_, index) => {
      const localChapter = index + 1
      const sourceChapter = localChapter + section.sourceOffset
      return {
        ...section,
        sourceChapter,
        targetChapter: section.targetChapter ?? localChapter,
        url: `${baseUrl}/${section.slug}/${section.slug}_${sourceChapter}.html`,
      }
    })
  )

const addParsedPage = (bibles, page, parsed) => {
  for (const [language, chapter] of [
    ['greek', parsed.greek],
    ['french', parsed.french],
  ]) {
    bibles[language][page.book] ??= {}
    if (bibles[language][page.book][page.targetChapter]) {
      throw new Error(`Duplicate target chapter ${page.book}:${page.targetChapter}`)
    }
    bibles[language][page.book][page.targetChapter] = chapter
  }
}

const getCoverage = bible => {
  const hash = crypto.createHash('sha256')
  let chapterCount = 0
  let verseCount = 0

  for (const book of Object.keys(bible)
    .map(Number)
    .sort((a, b) => a - b)) {
    for (const chapter of Object.keys(bible[book])
      .map(Number)
      .sort((a, b) => a - b)) {
      const verses = Object.keys(bible[book][chapter])
        .map(Number)
        .sort((a, b) => a - b)
      chapterCount += 1
      verseCount += verses.length
      hash.update(`${book}:${chapter}:${verses.join(',')}\n`)
    }
  }

  return {
    bookCount: Object.keys(bible).length,
    chapterCount,
    verseCount,
    coverageSha256: hash.digest('hex'),
  }
}

const createCanonicalBible = (bible, sourceSha256) => {
  const verses = {}
  const textHash = crypto.createHash('sha256')
  let verseCount = 0

  for (const book of Object.keys(bible)
    .map(Number)
    .sort((a, b) => a - b)) {
    const bookKey = String(book)
    verses[bookKey] = {}
    for (const chapter of Object.keys(bible[book])
      .map(Number)
      .sort((a, b) => a - b)) {
      const chapterKey = String(chapter)
      verses[bookKey][chapterKey] = {}
      for (const verse of Object.keys(bible[book][chapter])
        .map(Number)
        .sort((a, b) => a - b)) {
        const verseKey = String(verse)
        const payload = {
          text: bible[book][chapter][verse],
          startTags: [],
          layout: [],
          notes: [],
          headings: [],
        }
        verses[bookKey][chapterKey][verseKey] = payload
        textHash.update(`${JSON.stringify([book, chapter, verse, payload])}\n`)
        verseCount += 1
      }
    }
  }

  const textSha256 = textHash.digest('hex')
  return {
    format: 'bible-strong-canonical-bible',
    schemaVersion: 4,
    applicationVersionId: 'LXX',
    datasetId: 'LXX',
    sourceVersion: 'RAHLFS-THEOTEX',
    textRevision: `lxx-${textSha256.slice(0, 20)}`,
    textSha256,
    sourceSha256,
    verseCount,
    noteCount: 0,
    headingCount: 0,
    verses,
  }
}

const validateBiblePair = (greek, french, expected = {}) => {
  const errors = []
  const greekBooks = Object.keys(greek)
    .map(Number)
    .sort((a, b) => a - b)
  if (JSON.stringify(greekBooks) !== JSON.stringify(APP_BOOK_IDS)) {
    errors.push(`Book IDs differ from Bible Strong: ${greekBooks.join(', ')}`)
  }
  const frenchBooks = Object.keys(french)
    .map(Number)
    .sort((a, b) => a - b)
  if (JSON.stringify(frenchBooks) !== JSON.stringify(APP_BOOK_IDS)) {
    errors.push(`French book IDs differ from Bible Strong: ${frenchBooks.join(', ')}`)
  }

  const greekCoverage = getCoverage(greek)
  const frenchCoverage = getCoverage(french)
  if (greekCoverage.coverageSha256 !== frenchCoverage.coverageSha256) {
    errors.push('Greek and French verse coverage differs')
  }
  if (expected.chapterCount && greekCoverage.chapterCount !== expected.chapterCount) {
    errors.push(`Expected ${expected.chapterCount} chapters, found ${greekCoverage.chapterCount}`)
  }
  if (expected.verseCount && greekCoverage.verseCount !== expected.verseCount) {
    errors.push(`Expected ${expected.verseCount} verses, found ${greekCoverage.verseCount}`)
  }
  if (expected.coverageSha256 && greekCoverage.coverageSha256 !== expected.coverageSha256) {
    errors.push('Coverage checksum differs from the audited extraction')
  }

  for (const [language, bible] of [
    ['Greek', greek],
    ['French', french],
  ]) {
    for (const [book, chapters] of Object.entries(bible)) {
      for (const [chapter, verses] of Object.entries(chapters)) {
        for (const [verse, text] of Object.entries(verses)) {
          if (!Number.isInteger(Number(verse)) || Number(verse) < 0) {
            errors.push(`${language} invalid verse key ${book}:${chapter}:${verse}`)
          }
          if (typeof text !== 'string' || !text.trim()) {
            errors.push(`${language} empty verse ${book}:${chapter}:${verse}`)
          }
          if (text.includes('\ufffd')) {
            errors.push(`${language} replacement character at ${book}:${chapter}:${verse}`)
          }
          if (/\p{Surrogate}/u.test(text))
            errors.push(`${language} invalid Unicode at ${book}:${chapter}:${verse}`)
        }
      }
    }
  }

  if (errors.length)
    throw new Error(`ThéoTeX Septuagint validation failed:\n- ${errors.join('\n- ')}`)
  return greekCoverage
}

module.exports = {
  APP_BOOK_IDS,
  SOURCE_SECTIONS,
  addParsedPage,
  buildSourcePages,
  createCanonicalBible,
  getCoverage,
  normalizeVerseText,
  parseTheotexChapter,
  validateBiblePair,
}
