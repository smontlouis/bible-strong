#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'
import { Buffer } from 'node:buffer'

const require = createRequire(import.meta.url)
const {
  parseClementineVulgateFiles,
  validateClementineVulgate,
} = require('./lib/clementineVulgate.cjs')

const SOURCE_REVISION = 'edc85da058be630183d26e4deb6714ade80e600c'
const SOURCE_PAGE_URL = `https://bitbucket.org/clementinetextproject/text/src/${SOURCE_REVISION}/`
const SOURCE_ARCHIVE_URL = `https://bitbucket.org/clementinetextproject/text/get/${SOURCE_REVISION}.tar.gz`
const RIGHTS_URL =
  'https://bitbucket.org/clementinetextproject/website/raw/ac930d3f78d163f9cd9cf6067ed94e6708ebc9e9/htdocs/index.html'
const EXPECTED_ARCHIVE_SHA256 = 'bd7c226655a51424fdb195f38000e7a215d48ec8c88391227c85418b7e7db0c7'
const EXPECTED_SOURCE_FILES_SHA256 =
  '2f09b01499c628046c3c892b53d3604e7d263662181679a16e152d6d8a46ba15'
const DEFAULT_OUTPUT = '.scratch/generated/bible-vul.json'

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
  console.log(`Generate Bible Strong JSON for the Clementine Vulgate.

Usage:
  yarn bible:vul:generate [--output .scratch/generated/bible-vul.json] [--pretty]

The pinned public-domain source is published by the Clementine Text Project:
  ${SOURCE_PAGE_URL}

Options:
  --output, -o   Output JSON path. Defaults to ${DEFAULT_OUTPUT}.
  --pretty       Pretty-print JSON for review.
  --help, -h     Show this help.

The generator writes a provenance manifest next to the JSON artifact.
This command produces a validated import candidate. It does not publish or activate a resource.
`)
}

const loadSourceArchive = async () => {
  const response = await fetch(SOURCE_ARCHIVE_URL, {
    headers: {
      'user-agent': 'bible-strong-clementine-vulgate-generator/1.0',
    },
  })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${SOURCE_ARCHIVE_URL}: ${response.status} ${response.statusText}`
    )
  }

  return Buffer.from(await response.arrayBuffer())
}

const readTarString = (header, start, length) =>
  header
    .subarray(start, start + length)
    .toString('utf8')
    .replace(/\0.*$/s, '')

const extractSourceFiles = archive => {
  const tar = zlib.gunzipSync(archive)
  const sourceFiles = {}
  let offset = 0

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break

    const name = readTarString(header, 0, 100)
    const prefix = readTarString(header, 345, 155)
    const fullName = prefix ? `${prefix}/${name}` : name
    const fileName = path.posix.basename(fullName)
    const sizeValue = readTarString(header, 124, 12).trim()
    const size = Number.parseInt(sizeValue || '0', 8)
    const typeFlag = header[156]
    const dataOffset = offset + 512

    if (!Number.isSafeInteger(size) || size < 0 || dataOffset + size > tar.length) {
      throw new Error(`Invalid TAR entry size for ${fullName}`)
    }
    if ((typeFlag === 0 || typeFlag === 48) && fileName.endsWith('.lat')) {
      sourceFiles[fileName] = Buffer.from(tar.subarray(dataOffset, dataOffset + size))
    }

    offset = dataOffset + Math.ceil(size / 512) * 512
  }

  return sourceFiles
}

const getSourceFilesSha256 = sourceFiles => {
  const hash = crypto.createHash('sha256')
  Object.keys(sourceFiles)
    .sort()
    .forEach(fileName => {
      hash.update(fileName).update('\0').update(sourceFiles[fileName]).update('\0')
    })
  return hash.digest('hex')
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
  const sourceArchive = await loadSourceArchive()
  const archiveSha256 = sha256(sourceArchive)
  if (archiveSha256 !== EXPECTED_ARCHIVE_SHA256) {
    throw new Error(
      `Audited source archive checksum changed: expected ${EXPECTED_ARCHIVE_SHA256}, found ${archiveSha256}`
    )
  }

  const sourceFiles = extractSourceFiles(sourceArchive)
  const sourceFilesSha256 = getSourceFilesSha256(sourceFiles)
  if (sourceFilesSha256 !== EXPECTED_SOURCE_FILES_SHA256) {
    throw new Error(
      `Audited source files checksum changed: expected ${EXPECTED_SOURCE_FILES_SHA256}, found ${sourceFilesSha256}`
    )
  }

  const parsed = parseClementineVulgateFiles(sourceFiles)
  const validation = validateClementineVulgate(parsed.bible)
  const artifactBytes = await writeArtifact(outputPath, parsed.bible, args.pretty)

  const manifest = {
    format: 'bible-strong-bible-source',
    versionId: 'VUL',
    language: 'la',
    edition:
      'Vulgate clémentine — transcription du Clementine Text Project, fondée sur l’Editio Typica de 1598',
    sourcePage: SOURCE_PAGE_URL,
    sourceArchive: SOURCE_ARCHIVE_URL,
    sourceRevision: SOURCE_REVISION,
    sourceEncoding: 'windows-1252',
    archiveSha256,
    sourceFileCount: Object.keys(sourceFiles).length,
    sourceFilesSha256,
    artifactSha256: sha256(artifactBytes),
    artifactFormat: 'bible-strong-json-v1',
    canonId: 'clementine-vulgate',
    versificationId: 'clementine-vulgate',
    bookCount: validation.bookCount,
    chapterCount: validation.chapterCount,
    verseCount: validation.verseCount,
    coverageSha256: validation.coverageSha256,
    validatedCoverage: {
      firstBook: 1,
      lastBook: 73,
      complete: true,
    },
    joelChapterCounts: validation.joelChapterCounts,
    integratedAdditions: {
      estherChapterCount: 16,
      danielChapterCount: 14,
      baruchChapterCount: 6,
    },
    excludedAppendices: ['Prayer of Manasses', '3 Esdras', '4 Esdras'],
    rights: 'Public domain',
    rightsHolder: null,
    rightsReviewDate: '2026-07-20',
    termsReference: RIGHTS_URL,
    permittedDeliveryModes: {
      online: true,
      offline: true,
    },
    attribution: 'Source text: Clementine Text Project. Converted and normalized for Bible Strong.',
    transformations: [
      'Decoded Windows-1252 source files to Unicode',
      'Converted paragraph and poetic line-break markers to normalized spaces',
      'Removed poetic delimiters while preserving their text',
      'Converted speaker, acrostic, and prologue tags to plain labels',
      'Removed the non-verse Baruch 6 epistle heading',
    ],
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`Generated ${path.relative(repoRoot, outputPath)}`)
  console.log(`Manifest ${path.relative(repoRoot, manifestPath)}`)
  console.log(`Source revision: ${SOURCE_REVISION}`)
  console.log(`Source files SHA-256: ${manifest.sourceFilesSha256}`)
  console.log(`Artifact SHA-256: ${manifest.artifactSha256}`)
  console.log(`Books: ${manifest.bookCount}`)
  console.log(`Chapters: ${manifest.chapterCount}`)
  console.log(`Verses: ${manifest.verseCount}`)
  console.log(`Joel: ${manifest.joelChapterCounts.join(', ')} verses`)
  console.log('Publication: not performed (validated import candidate only)')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
