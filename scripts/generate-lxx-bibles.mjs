#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'

const require = createRequire(import.meta.url)
const {
  APP_BOOK_IDS,
  addParsedPage,
  buildSourcePages,
  createCanonicalBible,
  parseTheotexChapter,
  validateBiblePair,
} = require('./lib/theotexSeptuagint.cjs')

const SOURCE_PAGE_URL = 'https://theotex.org/septuaginta/genese/genese_1.html'
const DEFAULT_LEGACY_OUTPUT = '.scratch/generated/bible-lxx.json'
const DEFAULT_CANONICAL_ARCHIVE_OUTPUT = '.scratch/generated/bible-lxx.json.zip'
const CANONICAL_ENTRY = 'bible-lxx.json'
const CONCURRENCY = 10
const REPRODUCIBLE_ZIP_TIME = new Date('1980-01-01T00:00:00.000Z')
const EXPECTED_SOURCE_PAGES_SHA256 =
  '18e791848004764fdaca7eff8b0133a7637e8e6e31f7741f7c7279365b96428b'
const SOURCE_REVIEW_DATE = '2026-08-04'
const execFileAsync = promisify(execFile)

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

const parseArgs = argv => {
  const args = {
    legacyOutput: DEFAULT_LEGACY_OUTPUT,
    canonicalArchiveOutput: DEFAULT_CANONICAL_ARCHIVE_OUTPUT,
    pretty: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--pretty') args.pretty = true
    else if (arg === '--legacy-output') args.legacyOutput = argv[++index]
    else if (arg.startsWith('--legacy-output='))
      args.legacyOutput = arg.slice('--legacy-output='.length)
    else if (arg === '--canonical-archive-output') args.canonicalArchiveOutput = argv[++index]
    else if (arg.startsWith('--canonical-archive-output='))
      args.canonicalArchiveOutput = arg.slice('--canonical-archive-output='.length)
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (typeof args.legacyOutput !== 'string' || !/\.json$/i.test(args.legacyOutput)) {
    throw new Error('--legacy-output must end with .json')
  }
  if (
    typeof args.canonicalArchiveOutput !== 'string' ||
    !/\.json\.zip$/i.test(args.canonicalArchiveOutput)
  ) {
    throw new Error('--canonical-archive-output must end with .json.zip')
  }
  return args
}

const printHelp = () =>
  console.log(`Generate the Greek ThéoTeX Septuagint for Bible Strong.

Usage:
  yarn bible:lxx:generate [--pretty]

Outputs:
  Legacy JSON: ${DEFAULT_LEGACY_OUTPUT}
  Canonical V4 ZIP: ${DEFAULT_CANONICAL_ARCHIVE_OUTPUT}

The canonical Catholic books use Bible Strong IDs 1-39 and 67-73. The additional
ThéoTeX works use IDs 74-77. Ezra/Nehemiah, the Letter of Jeremiah, Susanna,
and Bel and the Dragon are normalized to stable Bible Strong identities.
`)

const fetchPage = async page => {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(page.url, {
        headers: { 'user-agent': 'bible-strong-theotex-septuagint-generator/1.0' },
      })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const html = await response.text()
      return { page, html, parsed: parseTheotexChapter(html) }
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 250))
    }
  }
  throw new Error(`Failed to fetch ${page.url}: ${lastError?.message ?? lastError}`)
}

const fetchAllPages = async pages => {
  const results = new Array(pages.length)
  let nextIndex = 0
  let completed = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (nextIndex < pages.length) {
      const index = nextIndex++
      results[index] = await fetchPage(pages[index])
      completed += 1
      if (completed % 100 === 0 || completed === pages.length) {
        console.log(`Fetched ${completed}/${pages.length} chapters`)
      }
    }
  })
  await Promise.all(workers)
  return results
}

const writeJson = async (outputPath, value, pretty) => {
  const bytes = Buffer.from(pretty ? `${JSON.stringify(value, null, 2)}\n` : JSON.stringify(value))
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, bytes)
  return bytes
}

const writeCanonicalArchive = async (archivePath, canonicalBible) => {
  const canonicalBytes = Buffer.from(`${JSON.stringify(canonicalBible)}\n`)
  await fs.mkdir(path.dirname(archivePath), { recursive: true })
  const stagingRoot = await fs.mkdtemp(path.join(path.dirname(archivePath), '.lxx-zip-'))
  const stagedEntry = path.join(stagingRoot, CANONICAL_ENTRY)

  try {
    await fs.writeFile(stagedEntry, canonicalBytes)
    await fs.chmod(stagedEntry, 0o644)
    await fs.utimes(stagedEntry, REPRODUCIBLE_ZIP_TIME, REPRODUCIBLE_ZIP_TIME)
    await fs.rm(archivePath, { force: true })
    await execFileAsync('zip', ['-X', '-9', '-q', archivePath, CANONICAL_ENTRY], {
      cwd: stagingRoot,
      env: { ...process.env, TZ: 'UTC' },
    })
    const archiveBytes = await fs.readFile(archivePath)
    return {
      contentBytes: canonicalBytes.length,
      contentSha256: sha256(canonicalBytes),
      archiveBytes: archiveBytes.length,
      archiveSha256: sha256(archiveBytes),
    }
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true })
  }
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) return printHelp()

  const pages = buildSourcePages()
  const results = await fetchAllPages(pages)
  const bibles = { greek: {}, french: {} }
  const sourceHash = crypto.createHash('sha256')
  for (const result of results) {
    addParsedPage(bibles, result.page, result.parsed)
    sourceHash.update(result.page.url).update('\0').update(result.html).update('\0')
  }
  const sourcePagesSha256 = sourceHash.digest('hex')
  if (sourcePagesSha256 !== EXPECTED_SOURCE_PAGES_SHA256) {
    throw new Error(
      `Audited ThéoTeX pages changed: expected ${EXPECTED_SOURCE_PAGES_SHA256}, found ${sourcePagesSha256}`
    )
  }

  const coverage = validateBiblePair(bibles.greek, bibles.french, {
    chapterCount: 1122,
    verseCount: 28616,
    coverageSha256: '31390113ebb3d127726f496878b38cf09fed4f8998548ba0205061dd601f3bbc',
  })
  const repoRoot = process.cwd()
  const legacyOutput = path.resolve(repoRoot, args.legacyOutput)
  const canonicalArchiveOutput = path.resolve(repoRoot, args.canonicalArchiveOutput)
  const legacyBytes = await writeJson(legacyOutput, bibles.greek, args.pretty)
  const canonicalBible = createCanonicalBible(bibles.greek, sourcePagesSha256)
  const canonicalArtifact = await writeCanonicalArchive(canonicalArchiveOutput, canonicalBible)
  const manifestPath = legacyOutput.replace(/\.json$/i, '.manifest.json')
  const manifest = {
    format: 'bible-strong-bible-source',
    versionId: 'LXX',
    language: 'grc',
    edition: 'Septante grecque publiée par ThéoTeX Éditions, texte grec de Rahlfs',
    sourcePage: SOURCE_PAGE_URL,
    sourceReviewDate: SOURCE_REVIEW_DATE,
    sourcePageCount: pages.length,
    sourcePagesSha256,
    artifacts: {
      legacy: {
        path: path.relative(repoRoot, legacyOutput),
        format: 'bible-strong-json-v1',
        bytes: legacyBytes.length,
        sha256: sha256(legacyBytes),
      },
      canonical: {
        path: path.relative(repoRoot, canonicalArchiveOutput),
        format: canonicalBible.format,
        schemaVersion: canonicalBible.schemaVersion,
        entry: CANONICAL_ENTRY,
        textRevision: canonicalBible.textRevision,
        textSha256: canonicalBible.textSha256,
        ...canonicalArtifact,
      },
    },
    canonId: 'theotex-septuagint',
    versificationId: 'theotex-septuagint',
    ...coverage,
    bookIds: APP_BOOK_IDS,
    integratedAdditions: {
      esther: 'Alphanumeric source additions are folded into their numeric verse',
      daniel: { susannaChapter: 13, belAndTheDragonChapter: 14 },
      baruch: { letterOfJeremiahChapter: 6 },
    },
    additionalWorks: {
      74: '1 Esdras',
      75: '3 Maccabees',
      76: '4 Maccabees',
      77: 'Psalms of Solomon',
    },
    includedAppendices: ['Psalm 151', 'Sirach translator prologue (chapter 52)'],
    rights: 'Authorized for redistribution by Bible Strong',
    rightsHolder: 'Éditions ThéoTeX',
    rightsReviewDate: '2026-08-04',
    termsReference: 'Authorization confirmed by the Bible Strong project owner on 2026-08-04',
    permittedDeliveryModes: {
      online: true,
      offline: true,
    },
    attribution: 'Source text: ThéoTeX Éditions (theotex.org). Converted for Bible Strong.',
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`Generated legacy JSON ${path.relative(repoRoot, legacyOutput)}`)
  console.log(`Generated canonical ZIP ${path.relative(repoRoot, canonicalArchiveOutput)}`)
  console.log(`Canonical entry: ${CANONICAL_ENTRY}`)
  console.log(`Text revision: ${canonicalBible.textRevision}`)
  console.log(`Manifest ${path.relative(repoRoot, manifestPath)}`)
  console.log(`Books: ${coverage.bookCount}`)
  console.log(`Chapters: ${coverage.chapterCount}`)
  console.log(`Verses: ${coverage.verseCount}`)
  console.log(`Coverage SHA-256: ${coverage.coverageSha256}`)
  console.log('Publication: not performed (validated import candidates only)')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
