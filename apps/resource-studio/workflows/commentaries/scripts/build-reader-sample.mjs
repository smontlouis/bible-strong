#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './firestore.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')
const workspaceRoot = path.resolve(prototypeRoot, '../../../..')
const defaultMhyZip = path.join(
  workspaceRoot,
  'apps/resource-studio/outputs/releases/mobile-resources-name-meanings-20260825/databases/commentaires-mhy.sqlite.zip'
)

const parseArguments = argv => {
  const values = {
    exportRoot: path.join(prototypeRoot, '.local', 'full-export'),
    output: path.join(prototypeRoot, 'data', 'comments.json'),
    mhyZip: defaultMhyZip,
    aquiferRoot: null,
    passages: ['1-1-1', '43-3-16', '1-24-31', '1-5-11'],
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--export-root') values.exportRoot = path.resolve(argv[++index])
    else if (argument === '--output') values.output = path.resolve(argv[++index])
    else if (argument === '--mhy-zip') values.mhyZip = path.resolve(argv[++index])
    else if (argument === '--aquifer-root') values.aquiferRoot = path.resolve(argv[++index])
    else if (argument === '--passages') values.passages = argv[++index].split(',').filter(Boolean)
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  return values
}

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))

const buildMhySamples = async (zipPath, passages) => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'bible-strong-mhy-'))
  try {
    execFileSync('unzip', ['-q', zipPath, '-d', temporaryDirectory])
    const databasePath = path.join(temporaryDirectory, 'commentaires-mhy.sqlite')
    const chapters = [...new Set(passages.map(passage => passage.split('-').slice(0, 2).join('-')))]
    const quoted = chapters.map(chapter => `'${chapter.replaceAll("'", "''")}'`).join(',')
    const rows = JSON.parse(
      execFileSync('sqlite3', ['-json', databasePath, `SELECT id, commentaires FROM COMMENTAIRES WHERE id IN (${quoted})`], { encoding: 'utf8' }) || '[]'
    )
    const byChapter = new Map(rows.map(row => [row.id, JSON.parse(row.commentaires)]))
    return passages.flatMap(passage => {
      const [book, chapter, verse] = passage.split('-')
      const chapterComments = byChapter.get(`${book}-${chapter}`)
      const candidate = chapterComments?.[verse] ?? chapterComments?.[String(Math.max(1, Number(verse) - 1))]
      if (!candidate) return []
      return [{
        schemaVersion: 1,
        id: `mhy-fr:${passage}`,
        passage,
        resource: { id: 'mhy-fr', name: 'Commentaire concis de Matthew Henry', author: 'Matthew Henry', sourceLanguage: 'en', license: 'CustomPermission' },
        source: { language: 'en', html: '', sha256: null, provenance: 'Source anglaise non incluse dans cet échantillon' },
        translation: { language: 'fr', html: candidate, sha256: sha256(candidate), provenance: 'SQLite MHY français issu du fichier transmis par Dominique Osché' },
      }]
    })
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

const buildAquiferSamples = async (aquiferRoot, passages) => {
  if (!aquiferRoot) return []
  const bookIds = [...new Set(passages.map(passage => passage.split('-')[0].padStart(2, '0')))]
  const entries = []
  for (const bookId of bookIds) {
    const [english, french] = await Promise.all([
      readJson(path.join(aquiferRoot, 'eng/json', `${bookId}.content.json`)),
      readJson(path.join(aquiferRoot, 'fra/json', `${bookId}.content.json`)),
    ])
    const frenchByReference = new Map(french.map(entry => [entry.reference_id, entry]))
    for (const source of english) {
      const association = source.associations?.passage?.[0]
      if (!association) continue
      const index = association.start_ref
      const passage = `${Number(index.slice(0, 2))}-${Number(index.slice(2, 5))}-${Number(index.slice(5, 8))}`
      if (!passages.includes(passage)) continue
      const translation = frenchByReference.get(source.reference_id)
      entries.push({
        schemaVersion: 1,
        id: `aquifer:${source.content_id}`,
        passage,
        passageEnd: association.end_ref_usfm,
        resource: { id: 'aquifer-fr', name: 'Tyndale Open Study Notes', author: 'Tyndale House Publishers', sourceLanguage: 'en', license: 'CC-BY-SA-4.0' },
        source: { language: 'en', html: source.content, sha256: sha256(source.content), provenance: `Aquifer ${source.version}` },
        translation: translation ? { language: 'fr', html: translation.content, sha256: sha256(translation.content), provenance: `Aquifer ${translation.version}` } : null,
      })
    }
  }
  return entries
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  const classicEntries = (
    await Promise.all(['acbc', 'barnes'].map(code => readJson(path.join(options.exportRoot, 'comments', `${code}.json`))))
  ).flat().filter(entry => options.passages.includes(entry.passage))
  const [mhyEntries, aquiferEntries] = await Promise.all([
    buildMhySamples(options.mhyZip, options.passages),
    buildAquiferSamples(options.aquiferRoot, options.passages),
  ])
  const entries = [...classicEntries, ...mhyEntries, ...aquiferEntries].sort((left, right) =>
    left.passage.localeCompare(right.passage, 'fr', { numeric: true }) || left.resource.id.localeCompare(right.resource.id)
  )
  const dataset = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    description: 'Échantillon local du prototype; aucune donnée distante n’est modifiée.',
    sourceExport: 'Firestore ACBC/Barnes + SQLite MHY + Aquifer Open Study Notes',
    entries,
  }
  await writeFile(options.output, `${JSON.stringify(dataset, null, 2)}\n`)
  process.stdout.write(`Écrit ${entries.length} unités dans ${options.output}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})
