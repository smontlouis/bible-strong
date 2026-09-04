const { Buffer } = require('node:buffer')
const crypto = require('node:crypto')

const LAUSANNE_BOOK_COUNT = 66
const LAUSANNE_VERSE_COUNT = 31105
const LAUSANNE_COVERAGE_SHA256 = 'fa610f8ccbb76054800032069e0a1bf93db8e12f0e047050b4a1d072df77579f'
const JOEL_BOOK_NUMBER = 29
const JOEL_SOURCE_SPLIT_CHAPTER = 2
const JOEL_SOURCE_FINAL_CHAPTER = 3
const JOEL_APP_INSERTED_CHAPTER = 3
const JOEL_APP_FINAL_CHAPTER = 4
const JOEL_SOURCE_CHAPTER_TWO_LAST_APP_CHAPTER_TWO_VERSE = 27
const EXPECTED_JOEL_CHAPTER_COUNTS = [20, 27, 5, 21]

const LAUSANNE_BOOK_CODES = [
  'Gen',
  'Exo',
  'Lev',
  'Num',
  'Deu',
  'Jos',
  'Jdg',
  'Rut',
  '1Sa',
  '2Sa',
  '1Ki',
  '2Ki',
  '1Ch',
  '2Ch',
  'Ezr',
  'Neh',
  'Est',
  'Job',
  'Psa',
  'Pro',
  'Ecc',
  'Sol',
  'Isa',
  'Jer',
  'Lam',
  'Eze',
  'Dan',
  'Hos',
  'Joe',
  'Amo',
  'Oba',
  'Jon',
  'Mic',
  'Nah',
  'Hab',
  'Zep',
  'Hag',
  'Zec',
  'Mal',
  'Mat',
  'Mar',
  'Luk',
  'Joh',
  'Act',
  'Rom',
  '1Co',
  '2Co',
  'Gal',
  'Eph',
  'Phi',
  'Col',
  '1Th',
  '2Th',
  '1Ti',
  '2Ti',
  'Tit',
  'Phm',
  'Heb',
  'Jam',
  '1Pe',
  '2Pe',
  '1Jo',
  '2Jo',
  '3Jo',
  'Jud',
  'Rev',
]

const BOOK_NUMBER_BY_CODE = new Map(
  LAUSANNE_BOOK_CODES.map((bookCode, index) => [bookCode, index + 1])
)

const WINDOWS_1252_SPECIAL_CHARACTERS = [
  '\u20ac',
  '\u0081',
  '\u201a',
  '\u0192',
  '\u201e',
  '\u2026',
  '\u2020',
  '\u2021',
  '\u02c6',
  '\u2030',
  '\u0160',
  '\u2039',
  '\u0152',
  '\u008d',
  '\u017d',
  '\u008f',
  '\u0090',
  '\u2018',
  '\u2019',
  '\u201c',
  '\u201d',
  '\u2022',
  '\u2013',
  '\u2014',
  '\u02dc',
  '\u2122',
  '\u0161',
  '\u203a',
  '\u0153',
  '\u009d',
  '\u017e',
  '\u0178',
]

const decodeWindows1252 = sourceBytes =>
  Buffer.from(sourceBytes)
    .toString('latin1')
    .replace(/[\u0080-\u009f]/g, character => {
      return WINDOWS_1252_SPECIAL_CHARACTERS[character.charCodeAt(0) - 0x80]
    })

const countVerses = bible =>
  Object.values(bible).reduce(
    (bookTotal, chapters) =>
      bookTotal +
      Object.values(chapters).reduce(
        (chapterTotal, verses) => chapterTotal + Object.keys(verses).length,
        0
      ),
    0
  )

const hasUnpairedSurrogate = text => {
  for (let index = 0; index < text.length; index++) {
    const codeUnit = text.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = text.charCodeAt(index + 1)
      if (!Number.isInteger(nextCodeUnit) || nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
        return true
      }
      index++
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true
    }
  }
  return false
}

const getCoverage = bible => {
  const errors = []
  const coverage = []
  const bookNumbers = Object.keys(bible)
    .map(Number)
    .sort((left, right) => left - right)

  bookNumbers.forEach(book => {
    const chapters = bible[book]
    if (!Number.isSafeInteger(book) || book < 1) {
      errors.push(`Invalid book number ${book}`)
    }
    const chapterNumbers = Object.keys(chapters)
      .map(Number)
      .sort((left, right) => left - right)

    chapterNumbers.forEach(chapter => {
      const verses = chapters[chapter]
      if (!Number.isSafeInteger(chapter) || chapter < 1) {
        errors.push(`Invalid chapter number ${book}.${chapter}`)
      }
      const verseNumbers = Object.keys(verses)
        .map(Number)
        .sort((left, right) => left - right)

      coverage.push(`${book}:${chapter}:${verseNumbers.length}`)

      verseNumbers.forEach((verse, verseIndex) => {
        const text = verses[verse]
        if (!Number.isSafeInteger(verse) || verse < 1) {
          errors.push(`Invalid verse number ${book}.${chapter}.${verse}`)
        } else if (verse !== verseIndex + 1) {
          errors.push(`Missing verse ${book}.${chapter}.${verseIndex + 1}`)
        }
        if (typeof text !== 'string' || !text.trim()) {
          errors.push(`Empty verse ${book}.${chapter}.${verse}`)
        } else if (
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/u.test(text) ||
          hasUnpairedSurrogate(text)
        ) {
          errors.push(`Invalid Unicode in verse ${book}.${chapter}.${verse}`)
        }
      })
    })
  })

  return {
    bookNumbers,
    coverage,
    coverageSha256: crypto.createHash('sha256').update(coverage.join('\n')).digest('hex'),
    errors,
  }
}

const mapLausanneReference = (book, chapter, verse) => {
  if (book !== JOEL_BOOK_NUMBER) return { book, chapter, verse }
  if (
    chapter === JOEL_SOURCE_SPLIT_CHAPTER &&
    verse > JOEL_SOURCE_CHAPTER_TWO_LAST_APP_CHAPTER_TWO_VERSE
  ) {
    return {
      book,
      chapter: JOEL_APP_INSERTED_CHAPTER,
      verse: verse - JOEL_SOURCE_CHAPTER_TWO_LAST_APP_CHAPTER_TWO_VERSE,
    }
  }
  if (chapter === JOEL_SOURCE_FINAL_CHAPTER) {
    return { book, chapter: JOEL_APP_FINAL_CHAPTER, verse }
  }
  return { book, chapter, verse }
}

const parseLausanneBibleText = source => {
  const bible = {}
  const errors = []
  let verseCount = 0
  let currentReference

  const lines = source.split(/\r\n|\n|\r/)
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    if (!line.trim()) return

    const match = line.match(/^(\S+)\s+(\d+):(\d+)(?:\s+(.*))?$/)
    if (!match) {
      if (currentReference && (/^\s/.test(line) || !currentReference.text)) {
        currentReference.text = `${currentReference.text} ${line.trim()}`.trim()
        bible[currentReference.book][currentReference.chapter][currentReference.verse] =
          currentReference.text
        return
      }
      errors.push(`Malformed line ${lineNumber}: ${line}`)
      return
    }

    const [, bookCode, chapterValue, verseValue, text] = match
    const book = BOOK_NUMBER_BY_CODE.get(bookCode)
    if (!book) {
      errors.push(`Unknown book code ${bookCode} on line ${lineNumber}`)
      return
    }

    const sourceChapter = Number(chapterValue)
    const sourceVerse = Number(verseValue)
    const mappedReference = mapLausanneReference(book, sourceChapter, sourceVerse)
    const chapter = mappedReference.chapter
    const verse = mappedReference.verse
    bible[mappedReference.book] ??= {}
    bible[mappedReference.book][chapter] ??= {}

    if (Object.hasOwn(bible[mappedReference.book][chapter], verse)) {
      errors.push(
        `Duplicate reference ${bookCode} ${sourceChapter}:${sourceVerse} on line ${lineNumber}`
      )
      return
    }

    const verseText = (text ?? '').trim()
    bible[mappedReference.book][chapter][verse] = verseText
    currentReference = {
      book: mappedReference.book,
      chapter,
      verse,
      text: verseText,
    }
    verseCount++
  })

  if (errors.length > 0) {
    throw new Error(`Lausanne parsing failed:\n- ${errors.join('\n- ')}`)
  }

  return { bible, verseCount }
}

const validateLausanneBible = (
  bible,
  {
    expectedBookCount = LAUSANNE_BOOK_COUNT,
    expectedBookNumbers = Array.from({ length: LAUSANNE_BOOK_COUNT }, (_, index) => index + 1),
    expectedVerseCount = LAUSANNE_VERSE_COUNT,
    expectedCoverageSha256 = LAUSANNE_COVERAGE_SHA256,
  } = {}
) => {
  const coverage = getCoverage(bible)
  const errors = [...coverage.errors]
  const books = coverage.bookNumbers
  const verseCount = countVerses(bible)

  if (books.length !== expectedBookCount) {
    errors.push(`Expected ${expectedBookCount} books, found ${books.length}`)
  }
  if (
    books.length !== expectedBookNumbers.length ||
    books.some((book, index) => book !== expectedBookNumbers[index])
  ) {
    errors.push(
      `Canonical book mapping mismatch: expected ${expectedBookNumbers.join(
        ','
      )}, found ${books.join(',')}`
    )
  }
  if (verseCount !== expectedVerseCount) {
    errors.push(`Expected ${expectedVerseCount} verses, found ${verseCount}`)
  }
  if (coverage.coverageSha256 !== expectedCoverageSha256) {
    errors.push(
      `Coverage checksum mismatch: expected ${expectedCoverageSha256}, found ${coverage.coverageSha256}`
    )
  }

  if (bible[2]?.[20]?.[14] !== "Tu ne commettras point d'adultère.") {
    errors.push('Exodus 20:14 does not match the audited Lausanne source')
  }

  const joelChapterCounts = [1, 2, 3, 4].map(
    chapter => Object.keys(bible[JOEL_BOOK_NUMBER]?.[chapter] ?? {}).length
  )
  if (
    joelChapterCounts.length !== EXPECTED_JOEL_CHAPTER_COUNTS.length ||
    joelChapterCounts.some(
      (chapterCount, index) => chapterCount !== EXPECTED_JOEL_CHAPTER_COUNTS[index]
    )
  ) {
    errors.push(
      `Joel is incomplete: expected ${EXPECTED_JOEL_CHAPTER_COUNTS.join(
        ','
      )} verses, found ${joelChapterCounts.join(',')}`
    )
  }

  if (errors.length > 0) {
    throw new Error(`Lausanne validation failed:\n- ${errors.join('\n- ')}`)
  }

  return {
    bookCount: books.length,
    chapterCount: coverage.coverage.length,
    coverageSha256: coverage.coverageSha256,
    verseCount,
    joelChapterCounts,
  }
}

module.exports = {
  LAUSANNE_COVERAGE_SHA256,
  LAUSANNE_BOOK_CODES,
  countVerses,
  decodeWindows1252,
  getCoverage,
  mapLausanneReference,
  parseLausanneBibleText,
  validateLausanneBible,
}
