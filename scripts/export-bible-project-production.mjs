#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  buildPassageMediaPack,
  sha256,
  validateSources,
} from './lib/bibleProjectProductionExport.mjs'

const DATA_DIR = 'docs/research/data/bible-project'
const OUTPUT_DIR = 'dist/passage-media'
const MANIFEST_FILES = [
  'book-overview-manifest.json',
  'visual-commentary-manifest.json',
  'word-study-manifest.json',
  'theme-manifest.json',
  'associated-resource-manifest.json',
]

const readJson = async path => JSON.parse(await readFile(path, 'utf8'))
const serialize = value => `${JSON.stringify(value, null, 2)}\n`

const main = async () => {
  const [catalog, ...manifests] = await Promise.all([
    readJson(`${DATA_DIR}/catalog.json`),
    ...MANIFEST_FILES.map(filename => readJson(`${DATA_DIR}/${filename}`)),
  ])
  validateSources({ manifests, catalog })
  const wordStudyManifest = manifests[2]
  const pack = buildPassageMediaPack({
    manifests,
    sharedWorkReferences: wordStudyManifest.sharedWorkReferences,
    generatedAt: catalog.generatedAt,
  })
  const editionCount = pack.works.reduce(
    (count, work) => count + Object.keys(work.editions).length,
    0
  )
  if (pack.works.length !== 286 || editionCount !== 491) {
    throw new Error(
      `Publication baseline changed: expected 286 works / 491 editions, received ${pack.works.length} / ${editionCount}`
    )
  }

  const packJson = serialize(pack)
  const artifactHash = sha256(packJson)
  const counts = {
    works: pack.works.length,
    editions: editionCount,
    frEditions: pack.works.filter(work => work.editions.fr).length,
    enEditions: pack.works.filter(work => work.editions.en).length,
    anchors: pack.works.reduce((count, work) => count + work.anchors.length, 0),
    indexedChapters: Object.keys(pack.indexes.chapters).length,
    indexedStrongs: Object.keys(pack.indexes.strongs).length,
    libraryWorks: pack.indexes.library.length,
  }
  const catalogOutput = {
    schemaVersion: 1,
    resourceId: 'passage-media',
    revision: pack.revision,
    generatedAt: pack.generatedAt,
    languages: pack.languages,
    languagePolicy: pack.languagePolicy,
    access: pack.access,
    attribution: pack.attribution,
    artifact: {
      path: 'passage-media.json',
      sha256: artifactHash,
      bytes: Buffer.byteLength(packJson),
    },
    counts,
  }
  const publicationReport = {
    schemaVersion: 1,
    status: 'valid',
    revision: pack.revision,
    generatedAt: pack.generatedAt,
    sourceManifests: MANIFEST_FILES,
    checks: [
      { id: 'reviewed-works-and-anchors', status: 'passed' },
      { id: 'languages-fr-en-only', status: 'passed' },
      { id: 'strict-language-no-fallback', status: 'passed' },
      { id: 'youtube-editions-unique', status: 'passed' },
      { id: 'vertical-formats-excluded', status: 'passed' },
      { id: 'publication-baseline', status: 'passed', counts },
      { id: 'artifact-sha256', status: 'passed', sha256: artifactHash },
    ],
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await Promise.all([
    writeFile(`${OUTPUT_DIR}/passage-media.json`, packJson),
    writeFile(`${OUTPUT_DIR}/catalog.json`, serialize(catalogOutput)),
    writeFile(`${OUTPUT_DIR}/publication-report.json`, serialize(publicationReport)),
  ])
  process.stderr.write(
    `Published ${counts.works} works / ${counts.editions} editions to ${OUTPUT_DIR}\n`
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
