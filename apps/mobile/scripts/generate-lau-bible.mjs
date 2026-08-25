#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Buffer } from 'node:buffer'

const require = createRequire(import.meta.url)
const {
  decodeWindows1252,
  parseLausanneBibleText,
  validateLausanneBible,
} = require('./lib/lausanneBible.cjs')

const SOURCE_PAGE_URL = 'https://sites.google.com/view/bibledelausanne'
const SOURCE_FILE_URL =
  'https://drive.usercontent.google.com/download?id=1NHb6BQKt8sfo839fhmPWO-MlvDvuDgJi&export=download&confirm=t'
const SOURCE_REVISION = '2025-04-18'
const EXPECTED_SOURCE_SHA256 = '03ec4063f42b828cdf07c4134bae26368461604b04d6462aa962fc1f47c85c96'
const DEFAULT_OUTPUT = '.scratch/generated/bible-lau.json'
const INDEPENDENT_AUDIT_DATE = '2026-07-20'
const INDEPENDENT_AUDIT_SOURCE = 'https://www.bibliauniversalis3.com'

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

const parseArgs = argv => {
  const args = {
    output: DEFAULT_OUTPUT,
    pretty: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      args.help = true
    } else if (arg === '--pretty') {
      args.pretty = true
    } else if (arg === '--output' || arg === '-o') {
      args.output = argv[++index]
    } else if (arg.startsWith('--output=')) {
      args.output = arg.slice('--output='.length)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

const printHelp = () => {
  console.log(`Generate Bible Strong JSON for the Lausanne Bible (1872).

Usage:
  yarn bible:lau:generate [--output .scratch/generated/bible-lau.json] [--pretty]

The default source is the 2025-04-18 public-domain transcription published by:
  ${SOURCE_PAGE_URL}

Options:
  --output, -o   Output JSON path. Defaults to ${DEFAULT_OUTPUT}.
  --pretty       Pretty-print JSON for review.
  --help, -h     Show this help.

The generator writes a provenance manifest next to the JSON artifact.
This command produces a validated import candidate. It does not publish or activate a resource.
`)
}

const loadSource = async () => {
  const response = await fetch(SOURCE_FILE_URL, {
    headers: {
      'user-agent': 'bible-strong-lausanne-generator/1.0',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_FILE_URL}: ${response.status} ${response.statusText}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

const writeArtifact = async (outputPath, bible, pretty) => {
  const json = pretty ? `${JSON.stringify(bible, null, 2)}\n` : JSON.stringify(bible)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, json)
  return Buffer.from(json)
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const outputPath = path.resolve(repoRoot, args.output)
  const manifestPath = outputPath.replace(/\.json$/i, '.manifest.json')
  const sourceBytes = await loadSource()
  const sourceSha256 = sha256(sourceBytes)

  if (sourceSha256 !== EXPECTED_SOURCE_SHA256) {
    throw new Error(
      `Audited source checksum changed: expected ${EXPECTED_SOURCE_SHA256}, found ${sourceSha256}`
    )
  }

  const sourceText = decodeWindows1252(sourceBytes)
  const parsed = parseLausanneBibleText(sourceText)
  const validation = validateLausanneBible(parsed.bible)
  const artifactBytes = await writeArtifact(outputPath, parsed.bible, args.pretty)

  const manifest = {
    format: 'bible-strong-bible-source',
    versionId: 'LAU',
    language: 'fr',
    edition: 'Lausanne Bible 1872',
    sourcePage: SOURCE_PAGE_URL,
    sourceFile: SOURCE_FILE_URL,
    sourceRevision: SOURCE_REVISION,
    sourceEncoding: 'windows-1252',
    sourceSha256,
    artifactSha256: sha256(artifactBytes),
    artifactFormat: 'bible-strong-json-v1',
    canonId: 'protestant-66',
    versificationId: 'bible-strong-french-4-chapter-joel',
    bookCount: validation.bookCount,
    chapterCount: validation.chapterCount,
    verseCount: validation.verseCount,
    coverageSha256: validation.coverageSha256,
    validatedCoverage: {
      firstBook: 1,
      lastBook: 66,
      complete: true,
    },
    sourceJoelChapterCounts: [20, 32, 21],
    joelChapterCounts: validation.joelChapterCounts,
    rights: 'Public domain',
    rightsHolder: null,
    rightsReviewDate: '2026-07-20',
    termsReference: SOURCE_PAGE_URL,
    permittedDeliveryModes: {
      online: true,
      offline: true,
    },
    attribution:
      'Old Testament digitized under Philippe Lacombe; New Testament digitized by Yves Pétrakian.',
    independentAudit: {
      auditedAt: INDEPENDENT_AUDIT_DATE,
      source: INDEPENDENT_AUDIT_SOURCE,
      exodus2014: "Tu ne commettras point d'adultère.",
      joelChapterCounts: [20, 27, 5, 21],
      joelLastVerse: "et l'Eternel demeurera en Sion.",
    },
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`Generated ${path.relative(repoRoot, outputPath)}`)
  console.log(`Manifest ${path.relative(repoRoot, manifestPath)}`)
  console.log(`Source revision: ${SOURCE_REVISION}`)
  console.log(`Source SHA-256: ${manifest.sourceSha256}`)
  console.log(`Artifact SHA-256: ${manifest.artifactSha256}`)
  console.log(`Books: ${manifest.bookCount}`)
  console.log(`Verses: ${manifest.verseCount}`)
  console.log(`Joel: ${manifest.joelChapterCounts.join(', ')} verses`)
  console.log('Publication: not performed (validated import candidate only)')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
