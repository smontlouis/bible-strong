const crypto = require('node:crypto')
const { Buffer } = require('node:buffer')

const CLEMENTINE_BOOK_COUNT = 73
const CLEMENTINE_CHAPTER_COUNT = 1334
const CLEMENTINE_VERSE_COUNT = 35809
const CLEMENTINE_COVERAGE_SHA256 =
  'b1bec95c007837053c0e4b0e7d32f303c7437157d95df33c258f44200da3ee9f'
const JOEL_BOOK_NUMBER = 29
const EXPECTED_JOEL_CHAPTER_COUNTS = [20, 32, 21]

const BOOK_NUMBER_BY_FILE = new Map([
  ['Gn.lat', 1],
  ['Ex.lat', 2],
  ['Lv.lat', 3],
  ['Nm.lat', 4],
  ['Dt.lat', 5],
  ['Jos.lat', 6],
  ['Jdc.lat', 7],
  ['Rt.lat', 8],
  ['1Rg.lat', 9],
  ['2Rg.lat', 10],
  ['3Rg.lat', 11],
  ['4Rg.lat', 12],
  ['1Par.lat', 13],
  ['2Par.lat', 14],
  ['Esr.lat', 15],
  ['Neh.lat', 16],
  ['Est.lat', 17],
  ['Job.lat', 18],
  ['Ps.lat', 19],
  ['Pr.lat', 20],
  ['Ecl.lat', 21],
  ['Ct.lat', 22],
  ['Is.lat', 23],
  ['Jr.lat', 24],
  ['Lam.lat', 25],
  ['Ez.lat', 26],
  ['Dn.lat', 27],
  ['Os.lat', 28],
  ['Joel.lat', 29],
  ['Am.lat', 30],
  ['Abd.lat', 31],
  ['Jon.lat', 32],
  ['Mch.lat', 33],
  ['Nah.lat', 34],
  ['Hab.lat', 35],
  ['Soph.lat', 36],
  ['Agg.lat', 37],
  ['Zach.lat', 38],
  ['Mal.lat', 39],
  ['Mt.lat', 40],
  ['Mc.lat', 41],
  ['Lc.lat', 42],
  ['Jo.lat', 43],
  ['Act.lat', 44],
  ['Rom.lat', 45],
  ['1Cor.lat', 46],
  ['2Cor.lat', 47],
  ['Gal.lat', 48],
  ['Eph.lat', 49],
  ['Phlp.lat', 50],
  ['Col.lat', 51],
  ['1Thes.lat', 52],
  ['2Thes.lat', 53],
  ['1Tim.lat', 54],
  ['2Tim.lat', 55],
  ['Tit.lat', 56],
  ['Phlm.lat', 57],
  ['Hbr.lat', 58],
  ['Jac.lat', 59],
  ['1Ptr.lat', 60],
  ['2Ptr.lat', 61],
  ['1Jo.lat', 62],
  ['2Jo.lat', 63],
  ['3Jo.lat', 64],
  ['Jud.lat', 65],
  ['Apc.lat', 66],
  ['Tob.lat', 67],
  ['Jdt.lat', 68],
  ['Sap.lat', 69],
  ['Sir.lat', 70],
  ['Bar.lat', 71],
  ['1Mcc.lat', 72],
  ['2Mcc.lat', 73],
])

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

const BARUCH_LETTER_HEADING =
  'Exemplar epistolæ quam misit Jeremias ad abducendos captivos in Babyloniam a rege Babyloniorum, ut annuntiaret illis secundum quod præceptum est illi a Deo'

const decodeWindows1252 = sourceBytes =>
  Buffer.from(sourceBytes)
    .toString('latin1')
    .replace(/[\u0080-\u009f]/g, character => {
      return WINDOWS_1252_SPECIAL_CHARACTERS[character.charCodeAt(0) - 0x80]
    })

const normalizeClementineVerseText = text =>
  text
    .replace(/<([^<>]+)>/g, (_match, label) =>
      label === BARUCH_LETTER_HEADING ? ' ' : `${label} `
    )
    .replace(/[\\/\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const DEFAULT_CANARIES = [
  {
    book: 1,
    chapter: 1,
    verse: 1,
    text: 'In principio creavit Deus cælum et terram.',
  },
  {
    book: 17,
    chapter: 16,
    verse: 24,
    text: 'Omnis autem provincia et civitas quæ noluerit solemnitatis hujus esse particeps, gladio et igne pereat, et sic deleatur, ut non solum hominibus, sed etiam bestiis invia sit in sempiternum, pro exemplo contemptus et inobedientiæ.',
  },
  {
    book: 27,
    chapter: 3,
    verse: 24,
    text: 'Et ambulabant in medio flammæ, laudantes Deum, et benedicentes Domino.',
  },
  {
    book: 27,
    chapter: 14,
    verse: 42,
    text: 'Tunc rex ait : Paveant omnes habitantes in universa terra Deum Danielis : quia ipse est salvator, faciens signa et mirabilia in terra : qui liberavit Danielem de lacu leonum.',
  },
  {
    book: 67,
    chapter: 1,
    verse: 1,
    text: 'Tobias ex tribu et civitate Nephthali (quæ est in superioribus Galilææ supra Naasson, post viam quæ ducit ad occidentem, in sinistro habens civitatem Sephet)',
  },
  {
    book: 71,
    chapter: 6,
    verse: 1,
    text: 'Propter peccata quæ peccastis ante Deum, abducemini in Babyloniam captivi a Nabuchodonosor rege Babylonis.',
  },
  {
    book: 73,
    chapter: 15,
    verse: 39,
    text: 'Et si quidem bene, et ut historiæ competit, hoc et ipse velim : sin autem minus digne, concedendum est mihi.',
  },
]

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

const getClementineCoverage = bible => {
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

    chapterNumbers.forEach((chapter, chapterIndex) => {
      const verses = chapters[chapter]
      if (!Number.isSafeInteger(chapter) || chapter < 1) {
        errors.push(`Invalid chapter number ${book}.${chapter}`)
      } else if (chapter !== chapterIndex + 1) {
        errors.push(`Missing chapter ${book}.${chapterIndex + 1}`)
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
    chapterCount: coverage.length,
    coverage,
    coverageSha256: crypto.createHash('sha256').update(coverage.join('\n')).digest('hex'),
    errors,
  }
}

const parseClementineVulgateFiles = files => {
  const bible = {}
  const errors = []
  let verseCount = 0

  Object.entries(files).forEach(([fileName, source]) => {
    const book = BOOK_NUMBER_BY_FILE.get(fileName)
    if (!book) {
      errors.push(`Unknown source file ${fileName}`)
      return
    }

    bible[book] ??= {}
    const decodedSource =
      typeof source === 'string' ? source : decodeWindows1252(Buffer.from(source))

    decodedSource.split(/\r\n|\n|\r/).forEach((line, index) => {
      const lineNumber = index + 1
      if (!line.trim()) return

      const match = line.match(/^(\d+):(\d+)(?:\s+(.*))?$/)
      if (!match) {
        errors.push(`Malformed line ${lineNumber} in ${fileName}: ${line}`)
        return
      }

      const [, chapterValue, verseValue, text] = match
      const chapter = Number(chapterValue)
      const verse = Number(verseValue)
      const verseText = normalizeClementineVerseText((text ?? '').trim())
      if (!verseText) {
        errors.push(`Empty verse ${fileName} ${chapter}:${verse} on line ${lineNumber}`)
        return
      }

      bible[book][chapter] ??= {}
      if (Object.hasOwn(bible[book][chapter], verse)) {
        errors.push(`Duplicate reference ${fileName} ${chapter}:${verse} on line ${lineNumber}`)
        return
      }

      bible[book][chapter][verse] = verseText
      verseCount++
    })
  })

  if (errors.length > 0) {
    throw new Error(`Clementine Vulgate parsing failed:\n- ${errors.join('\n- ')}`)
  }

  return { bible, verseCount }
}

const validateClementineVulgate = (
  bible,
  {
    expectedBookCount = CLEMENTINE_BOOK_COUNT,
    expectedBookNumbers = Array.from({ length: CLEMENTINE_BOOK_COUNT }, (_, index) => index + 1),
    expectedChapterCount = CLEMENTINE_CHAPTER_COUNT,
    expectedVerseCount = CLEMENTINE_VERSE_COUNT,
    expectedCoverageSha256 = CLEMENTINE_COVERAGE_SHA256,
    expectedJoelChapterCounts = EXPECTED_JOEL_CHAPTER_COUNTS,
    canaries = DEFAULT_CANARIES,
  } = {}
) => {
  const coverage = getClementineCoverage(bible)
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
  if (coverage.chapterCount !== expectedChapterCount) {
    errors.push(`Expected ${expectedChapterCount} chapters, found ${coverage.chapterCount}`)
  }
  if (verseCount !== expectedVerseCount) {
    errors.push(`Expected ${expectedVerseCount} verses, found ${verseCount}`)
  }
  if (coverage.coverageSha256 !== expectedCoverageSha256) {
    errors.push(
      `Coverage checksum mismatch: expected ${expectedCoverageSha256}, found ${coverage.coverageSha256}`
    )
  }

  const joelChapterCounts = [1, 2, 3].map(
    chapter => Object.keys(bible[JOEL_BOOK_NUMBER]?.[chapter] ?? {}).length
  )
  if (
    joelChapterCounts.length !== expectedJoelChapterCounts.length ||
    joelChapterCounts.some(
      (chapterCount, index) => chapterCount !== expectedJoelChapterCounts[index]
    )
  ) {
    errors.push(
      `Joel is incomplete: expected ${expectedJoelChapterCounts.join(
        ','
      )} verses, found ${joelChapterCounts.join(',')}`
    )
  }

  canaries.forEach(({ book, chapter, verse, text }) => {
    if (bible[book]?.[chapter]?.[verse] !== text) {
      errors.push(`Source canary mismatch at ${book}.${chapter}.${verse}`)
    }
  })

  if (errors.length > 0) {
    throw new Error(`Clementine Vulgate validation failed:\n- ${errors.join('\n- ')}`)
  }

  return {
    bookCount: books.length,
    chapterCount: coverage.chapterCount,
    coverageSha256: coverage.coverageSha256,
    verseCount,
    joelChapterCounts,
  }
}

module.exports = {
  BOOK_NUMBER_BY_FILE,
  CLEMENTINE_BOOK_COUNT,
  CLEMENTINE_CHAPTER_COUNT,
  CLEMENTINE_COVERAGE_SHA256,
  CLEMENTINE_VERSE_COUNT,
  DEFAULT_CANARIES,
  countVerses,
  decodeWindows1252,
  getClementineCoverage,
  normalizeClementineVerseText,
  parseClementineVulgateFiles,
  validateClementineVulgate,
}
