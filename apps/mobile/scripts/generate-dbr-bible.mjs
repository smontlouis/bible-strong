#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const SOURCE_PAGE_URL = 'https://editeurbpc.com/telechargements'
const FALLBACK_OSIS_URL = 'https://cdn.editeurbpc.com/bible/osis/DBR/bible_dbr_2_1.xml'
const DEFAULT_OUTPUT = '.scratch/generated/bible-dbr.json'

const OSIS_BOOK_CODES = [
  'Gen',
  'Exod',
  'Lev',
  'Num',
  'Deut',
  'Josh',
  'Judg',
  'Ruth',
  '1Sam',
  '2Sam',
  '1Kgs',
  '2Kgs',
  '1Chr',
  '2Chr',
  'Ezra',
  'Neh',
  'Esth',
  'Job',
  'Ps',
  'Prov',
  'Eccl',
  'Song',
  'Isa',
  'Jer',
  'Lam',
  'Ezek',
  'Dan',
  'Hos',
  'Joel',
  'Amos',
  'Obad',
  'Jonah',
  'Mic',
  'Nah',
  'Hab',
  'Zeph',
  'Hag',
  'Zech',
  'Mal',
  'Matt',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Rom',
  '1Cor',
  '2Cor',
  'Gal',
  'Eph',
  'Phil',
  'Col',
  '1Thess',
  '2Thess',
  '1Tim',
  '2Tim',
  'Titus',
  'Phlm',
  'Heb',
  'Jas',
  '1Pet',
  '2Pet',
  '1John',
  '2John',
  '3John',
  'Jude',
  'Rev',
]

const OSIS_TO_BOOK_NUMBER = new Map(OSIS_BOOK_CODES.map((code, index) => [code, index + 1]))

const parseArgs = argv => {
  const args = {
    output: DEFAULT_OUTPUT,
    sourcePageUrl: SOURCE_PAGE_URL,
    osisUrl: undefined,
    pretty: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      args.help = true
    } else if (arg === '--pretty') {
      args.pretty = true
    } else if (arg === '--output' || arg === '-o') {
      args.output = argv[++i]
    } else if (arg.startsWith('--output=')) {
      args.output = arg.slice('--output='.length)
    } else if (arg === '--source-page') {
      args.sourcePageUrl = argv[++i]
    } else if (arg.startsWith('--source-page=')) {
      args.sourcePageUrl = arg.slice('--source-page='.length)
    } else if (arg === '--osis-url') {
      args.osisUrl = argv[++i]
    } else if (arg.startsWith('--osis-url=')) {
      args.osisUrl = arg.slice('--osis-url='.length)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

const printHelp = () => {
  console.log(`Generate Bible Strong JSON for the BPC revised Darby Bible.

Usage:
  yarn bible:dbr:generate [--output .scratch/generated/bible-dbr.json] [--pretty]

Source:
  The script fetches ${SOURCE_PAGE_URL}, discovers the DBR OSIS XML URL, then
  downloads and converts that XML into the existing Bible Strong JSON shape:
  { "book": { "chapter": { "verse": "text" } } }.

Attribution:
  Source text: Bibles et Publications Chretiennes (BPC), La Bible - Traduction
  revisee, DBR. License shown by BPC: CC BY-NC-ND.

Options:
  --output, -o       Output JSON path. Defaults to ${DEFAULT_OUTPUT}.
  --source-page      Override the BPC downloads page used for discovery.
  --osis-url         Use a specific OSIS XML URL instead of discovery.
  --pretty           Pretty-print JSON for review.
  --help, -h         Show this help.

The generated JSON is intended to be uploaded separately to:
  https://assets.bible-strong.app/bibles/bible-dbr.json
`)
}

const fetchText = async url => {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'bible-strong-dbr-generator/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

const discoverOsisUrl = async sourcePageUrl => {
  const html = await fetchText(sourcePageUrl)
  const match = html.match(
    /href="(https?:\/\/cdn\.editeurbpc\.com\/bible\/osis\/DBR\/bible_dbr_[^"]+\.xml)"/i
  )

  if (!match) {
    console.warn(`Could not discover DBR OSIS URL from ${sourcePageUrl}; using fallback.`)
    return FALLBACK_OSIS_URL
  }

  return match[1].replace(/^http:/, 'https:')
}

const decodeEntities = value =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

const normalizeVerseText = value =>
  decodeEntities(value)
    .replace(/[\t\r\n ]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()

const getTagName = tag => {
  const match = tag.match(/^<\/?\s*([A-Za-z0-9:_-]+)/)
  return match?.[1]?.replace(/^osis:/, '') ?? ''
}

const getAttribute = (tag, attribute) => {
  const match = tag.match(new RegExp(`${attribute}="([^"]+)"`))
  return match?.[1]
}

const parseVerseId = osisId => {
  const match = osisId.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/)
  if (!match) return undefined

  const [, osisBook, chapter, verse] = match
  const book = OSIS_TO_BOOK_NUMBER.get(osisBook)
  if (!book) return undefined

  return {
    osisBook,
    book,
    chapter: Number(chapter),
    verse: Number(verse),
    key: `${book}.${chapter}.${verse}`,
  }
}

const addVerseText = (bible, current, rawText) => {
  const text = normalizeVerseText(rawText)
  if (!text) return

  const book = String(current.book)
  const chapter = String(current.chapter)
  const verse = String(current.verse)

  bible[book] ??= {}
  bible[book][chapter] ??= {}

  if (bible[book][chapter][verse]) {
    bible[book][chapter][verse] = `${bible[book][chapter][verse]} ${text}`
    return
  }

  bible[book][chapter][verse] = text
}

const parseOsis = xml => {
  const bible = {}
  const expectedVerseKeys = new Set()
  const seenStarts = new Set()
  const unsupportedVerseIds = []
  const duplicateVerseIds = []
  const unclosedVerseIds = []
  const unmatchedEndVerseIds = []

  let current = undefined
  let currentRawText = ''
  let skipDepth = 0
  let lastIndex = 0

  const tagPattern = /<[^>]+>/g
  let tagMatch
  while ((tagMatch = tagPattern.exec(xml))) {
    const tag = tagMatch[0]
    const textBetweenTags = xml.slice(lastIndex, tagMatch.index)

    if (current && skipDepth === 0) {
      currentRawText += textBetweenTags
    }

    const tagName = getTagName(tag)
    const isClosing = /^<\//.test(tag)
    const isSelfClosing = /\/>$/.test(tag)

    if (skipDepth > 0) {
      if (!isClosing && !isSelfClosing && tagName === 'note') skipDepth++
      if (isClosing && tagName === 'note') skipDepth--
      lastIndex = tagPattern.lastIndex
      continue
    }

    if (!isClosing && tagName === 'note') {
      if (!isSelfClosing) skipDepth++
      lastIndex = tagPattern.lastIndex
      continue
    }

    if (current && ['lb', 'lg', 'l'].includes(tagName)) {
      currentRawText += ' '
    }

    if (!isClosing && tagName === 'verse') {
      const startId = getAttribute(tag, 'sID')
      const endId = getAttribute(tag, 'eID')

      if (startId) {
        if (current) {
          unclosedVerseIds.push(current.osisId)
          addVerseText(bible, current, currentRawText)
        }

        const parsed = parseVerseId(startId)
        if (!parsed) {
          unsupportedVerseIds.push(startId)
          current = undefined
          currentRawText = ''
        } else {
          if (seenStarts.has(startId)) duplicateVerseIds.push(startId)
          seenStarts.add(startId)
          expectedVerseKeys.add(parsed.key)
          current = { ...parsed, osisId: startId }
          currentRawText = ''
        }
      } else if (endId) {
        if (!current || current.osisId !== endId) {
          unmatchedEndVerseIds.push(endId)
        } else {
          addVerseText(bible, current, currentRawText)
          current = undefined
          currentRawText = ''
        }
      }
    }

    lastIndex = tagPattern.lastIndex
  }

  if (current) {
    unclosedVerseIds.push(current.osisId)
    addVerseText(bible, current, currentRawText)
  }

  return {
    bible,
    expectedVerseKeys,
    issues: {
      unsupportedVerseIds,
      duplicateVerseIds,
      unclosedVerseIds,
      unmatchedEndVerseIds,
    },
  }
}

const loadBookChapters = async repoRoot => {
  const booksPath = path.join(repoRoot, 'src/assets/bible_versions/books-desc.ts')
  const source = await fs.readFile(booksPath, 'utf8')
  const flatBooksStart = source.indexOf('const books = [')
  if (flatBooksStart === -1) {
    throw new Error(`Could not find flat books list in ${path.relative(repoRoot, booksPath)}`)
  }

  const flatBooksSource = source.slice(flatBooksStart)
  const entries = [
    ...flatBooksSource.matchAll(/Numero:\s*(\d+),\s*Nom:\s*'([^']+)',\s*Chapitres:\s*(\d+),/g),
  ]

  if (entries.length !== OSIS_BOOK_CODES.length) {
    throw new Error(`Expected ${OSIS_BOOK_CODES.length} book definitions, found ${entries.length}`)
  }

  return entries.map(match => ({
    number: Number(match[1]),
    name: match[2],
    chapters: Number(match[3]),
  }))
}

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

const validateBible = ({ bible, expectedVerseKeys, issues }, bookChapters) => {
  const errors = []
  const warnings = []
  const expectedChaptersByBook = new Map()

  for (const [issueName, ids] of Object.entries(issues)) {
    if (ids.length > 0) {
      errors.push(`${issueName}: ${ids.slice(0, 10).join(', ')}${ids.length > 10 ? '...' : ''}`)
    }
  }

  for (const key of expectedVerseKeys) {
    const [book, chapter] = key.split('.')
    if (!expectedChaptersByBook.has(book)) expectedChaptersByBook.set(book, new Set())
    expectedChaptersByBook.get(book).add(chapter)
  }

  for (const { number, name, chapters } of bookChapters) {
    const bookKey = String(number)
    const book = bible[bookKey]
    if (!book) {
      errors.push(`Missing book ${number} (${name})`)
      continue
    }

    for (let chapter = 1; chapter <= chapters; chapter++) {
      const chapterKey = String(chapter)
      const verses = book[chapterKey]
      if (!verses) {
        if (expectedChaptersByBook.get(bookKey)?.has(chapterKey)) {
          errors.push(`Missing source chapter ${number}.${chapter} (${name})`)
        } else {
          warnings.push(`Source versification has no chapter ${number}.${chapter} (${name})`)
        }
        continue
      }

      const verseNumbers = Object.keys(verses)
        .map(Number)
        .sort((a, b) => a - b)

      if (verseNumbers.length === 0) {
        errors.push(`Empty chapter ${number}.${chapter} (${name})`)
        continue
      }

      const maxVerse = verseNumbers.at(-1)
      for (let verse = 1; verse <= maxVerse; verse++) {
        if (!verses[String(verse)]) {
          const key = `${number}.${chapter}.${verse}`
          if (expectedVerseKeys.has(key)) {
            errors.push(`Missing source verse ${key} (${name})`)
          } else {
            warnings.push(`Source versification omits verse ${key} (${name})`)
          }
        }
      }

      for (const verse of verseNumbers) {
        const text = verses[String(verse)]
        if (typeof text !== 'string' || text.trim().length === 0) {
          errors.push(`Empty verse text at ${number}.${chapter}.${verse} (${name})`)
        }
      }
    }
  }

  const missingExpectedVerses = []
  for (const key of expectedVerseKeys) {
    const [book, chapter, verse] = key.split('.')
    if (!bible[book]?.[chapter]?.[verse]) {
      missingExpectedVerses.push(key)
    }
  }
  if (missingExpectedVerses.length > 0) {
    errors.push(
      `Parsed output is missing source verse markers: ${missingExpectedVerses.slice(0, 10).join(', ')}${
        missingExpectedVerses.length > 10 ? '...' : ''
      }`
    )
  }

  if (errors.length > 0) {
    throw new Error(`DBR validation failed:\n- ${errors.join('\n- ')}`)
  }

  return warnings
}

const writeJson = async (outputPath, data, pretty) => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(
    outputPath,
    pretty ? `${JSON.stringify(data, null, 2)}\n` : JSON.stringify(data)
  )
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const outputPath = path.resolve(repoRoot, args.output)
  const osisUrl = args.osisUrl ?? (await discoverOsisUrl(args.sourcePageUrl))
  const xml = await fetchText(osisUrl)
  const bookChapters = await loadBookChapters(repoRoot)
  const parsed = parseOsis(xml)

  const warnings = validateBible(parsed, bookChapters)
  await writeJson(outputPath, parsed.bible, args.pretty)

  console.log(`Generated ${path.relative(repoRoot, outputPath)}`)
  console.log(`Source OSIS: ${osisUrl}`)
  console.log('Attribution: Bibles et Publications Chretiennes (BPC), DBR, CC BY-NC-ND')
  console.log(`Books: ${Object.keys(parsed.bible).length}`)
  console.log(`Verses: ${countVerses(parsed.bible)}`)
  if (warnings.length > 0) {
    console.log(`Source versification warnings: ${warnings.length}`)
    for (const warning of warnings.slice(0, 10)) {
      console.log(`- ${warning}`)
    }
    if (warnings.length > 10) console.log(`- ... ${warnings.length - 10} more`)
  }
  console.log(
    'Upload target expected by the app: https://assets.bible-strong.app/bibles/bible-dbr.json'
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
