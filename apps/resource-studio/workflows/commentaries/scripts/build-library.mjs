#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './firestore.mjs'
import { applyPublishedTranslations, loadPublishedTranslations } from './published-translations.mjs'
import { normalizeLibraryScopes } from './normalize-library-scopes.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')
const workspaceRoot = path.resolve(prototypeRoot, '../../../..')
const defaultMhyZip = path.join(
  workspaceRoot,
  'apps/resource-studio/outputs/releases/mobile-resources-name-meanings-20260825/databases/commentaires-mhy.sqlite.zip'
)

const bookNames = [
  'Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome', 'Josué', 'Juges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras',
  'Néhémie', 'Esther', 'Job', 'Psaumes', 'Proverbes', 'Ecclésiaste', 'Cantique des cantiques',
  'Ésaïe', 'Jérémie', 'Lamentations', 'Ézéchiel', 'Daniel', 'Osée', 'Joël', 'Amos',
  'Abdias', 'Jonas', 'Michée', 'Nahum', 'Habacuc', 'Sophonie', 'Aggée', 'Zacharie',
  'Malachie', 'Matthieu', 'Marc', 'Luc', 'Jean', 'Actes', 'Romains', '1 Corinthiens',
  '2 Corinthiens', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens', '1 Thessaloniciens',
  '2 Thessaloniciens', '1 Timothée', '2 Timothée', 'Tite', 'Philémon', 'Hébreux',
  'Jacques', '1 Pierre', '2 Pierre', '1 Jean', '2 Jean', '3 Jean', 'Jude', 'Apocalypse',
  'Tobie', 'Judith', 'Sagesse', 'Siracide', 'Baruch', '1 Maccabées', '2 Maccabées',
]

const parseArguments = argv => {
  const options = {
    exportRoot: path.join(prototypeRoot, '.local', 'full-export'),
    output: path.join(prototypeRoot, '.local', 'library'),
    mhyZip: defaultMhyZip,
    aquiferRoot: null,
    waveExport: path.join(prototypeRoot, '.local', 'wave-export'),
    bibleAnnoteeExport: path.join(prototypeRoot, '.local', 'bible-annotee-export'),
    wave3Export: path.join(prototypeRoot, '.local', 'wave-3-export'),
    douayRheimsExport: path.join(prototypeRoot, '.local', 'douay-rheims-export'),
    publishedTranslationRoot: path.join(prototypeRoot, 'data', 'translations', 'published'),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--export-root') options.exportRoot = path.resolve(argv[++index])
    else if (argument === '--output') options.output = path.resolve(argv[++index])
    else if (argument === '--mhy-zip') options.mhyZip = path.resolve(argv[++index])
    else if (argument === '--aquifer-root') options.aquiferRoot = path.resolve(argv[++index])
    else if (argument === '--wave-export') options.waveExport = path.resolve(argv[++index])
    else if (argument === '--bible-annotee-export') options.bibleAnnoteeExport = path.resolve(argv[++index])
    else if (argument === '--wave-3-export') options.wave3Export = path.resolve(argv[++index])
    else if (argument === '--douay-rheims-export') options.douayRheimsExport = path.resolve(argv[++index])
    else if (argument === '--published-translations') options.publishedTranslationRoot = path.resolve(argv[++index])
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  if (!options.aquiferRoot) throw new Error('--aquifer-root est requis pour construire Aquifer EN/FR intégralement')
  return options
}

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const chapterKey = passage => passage.split('-').slice(0, 2).join('-')
const parseAquiferReference = value =>
  `${Number(value.slice(0, 2))}-${Number(value.slice(2, 5))}-${Number(value.slice(5, 8))}`

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  await rm(options.output, { recursive: true, force: true })
  await mkdir(options.output, { recursive: true })

  const translationsByResource = new Map()
  const translationRevisions = {}
  for (const resourceId of ['acbc', 'barnes', 'aquifer-fr']) {
    const loaded = await loadPublishedTranslations(options.publishedTranslationRoot, resourceId)
    translationsByResource.set(resourceId, loaded.translations)
    if (loaded.revision) translationRevisions[resourceId] = loaded.revision
  }

  const chapters = new Map()
  const resourceCounts = {}
  const resourceChapters = {}
  const registerChunk = ({ resourceId, key, entries, relativePath, hash }) => {
    const [book, chapter] = key.split('-').map(Number)
    const record = chapters.get(key) ?? {
      book,
      bookName: bookNames[book - 1] ?? `Livre ${book}`,
      chapter,
      passages: new Set(),
      resources: {},
    }
    for (const entry of entries) record.passages.add(entry.passage)
    record.resources[resourceId] = { path: relativePath, count: entries.length, sha256: hash }
    chapters.set(key, record)
  }

  const writeChunks = async (resourceId, entries) => {
    const groups = new Map()
    for (const entry of entries) {
      const key = chapterKey(entry.passage)
      const group = groups.get(key) ?? []
      group.push(entry)
      groups.set(key, group)
    }
    let translatedCount = 0
    let missingCount = 0
    for (const [key, chapterEntries] of groups) {
      const existingResource = chapters.get(key)?.resources[resourceId]
      const existingEntries = existingResource
        ? (await readJson(path.join(options.output, existingResource.path))).entries
        : []
      const combinedEntries = [...existingEntries, ...chapterEntries]
      combinedEntries.sort((left, right) =>
        left.passage.localeCompare(right.passage, 'fr', { numeric: true }) || left.id.localeCompare(right.id, 'fr', { numeric: true })
      )
      for (const entry of chapterEntries) entry.translation ? translatedCount++ : missingCount++
      const [book, chapter] = key.split('-')
      const relativePath = `chunks/${book}/${chapter}/${resourceId}.json`
      const filePath = path.join(options.output, relativePath)
      const payload = JSON.stringify({ schemaVersion: 1, resourceId, entries: combinedEntries })
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, payload)
      registerChunk({ resourceId, key, entries: combinedEntries, relativePath, hash: sha256(payload) })
      ;(resourceChapters[resourceId] ??= new Set()).add(key)
    }
    const previous = resourceCounts[resourceId] ?? { entryCount: 0, translatedCount: 0, missingCount: 0, chapterCount: 0 }
    resourceCounts[resourceId] = {
      entryCount: previous.entryCount + entries.length,
      translatedCount: previous.translatedCount + translatedCount,
      missingCount: previous.missingCount + missingCount,
      chapterCount: resourceChapters[resourceId].size,
    }
  }

  for (const code of ['acbc', 'barnes']) {
    process.stderr.write(`Découpage complet de ${code}…\n`)
    const sourceEntries = await readJson(path.join(options.exportRoot, 'comments', `${code}.json`))
    const entries = applyPublishedTranslations(code, sourceEntries, translationsByResource.get(code))
    await writeChunks(code, entries)
  }

  process.stderr.write('Conversion complète de MHY français…\n')
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'bible-strong-mhy-library-'))
  try {
    execFileSync('unzip', ['-q', options.mhyZip, '-d', temporaryDirectory])
    const databasePath = path.join(temporaryDirectory, 'commentaires-mhy.sqlite')
    const rows = JSON.parse(
      execFileSync('sqlite3', ['-json', databasePath, 'SELECT id, commentaires FROM COMMENTAIRES ORDER BY id'], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      }) || '[]'
    )
    const entries = rows.flatMap(row => {
      const [book, chapter] = row.id.split('-').map(Number)
      return Object.entries(JSON.parse(row.commentaires)).flatMap(([verse, html]) => {
        if (!String(html).trim()) return []
        const passage = `${book}-${chapter}-${Number(verse)}`
        return [{
          schemaVersion: 1,
          id: `mhy-fr:${passage}`,
          passage,
          resource: { id: 'mhy-fr', name: 'Commentaire concis de Matthew Henry', author: 'Matthew Henry', sourceLanguage: 'en', license: 'CustomPermission' },
          source: { language: 'en', html: '', sha256: null, provenance: 'Source anglaise non incluse dans le corpus historique français' },
          translation: { language: 'fr', html, sha256: sha256(html), provenance: 'SQLite MHY français issu du fichier transmis par Dominique Osché' },
        }]
      })
    })
    await writeChunks('mhy-fr', entries)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }

  process.stderr.write('Conversion complète d’Aquifer EN/FR…\n')
  for (let book = 1; book <= 66; book += 1) {
    const bookId = String(book).padStart(2, '0')
    const [english, french] = await Promise.all([
      readJson(path.join(options.aquiferRoot, 'eng/json', `${bookId}.content.json`)),
      readJson(path.join(options.aquiferRoot, 'fra/json', `${bookId}.content.json`)),
    ])
    const frenchByReference = new Map(french.map(entry => [entry.reference_id, entry]))
    const sourceEntries = english.flatMap(source => {
      const association = source.associations?.passage?.[0]
      if (!association) return []
      const translation = frenchByReference.get(source.reference_id)
      return [{
        schemaVersion: 1,
        id: `aquifer:${source.content_id}`,
        passage: parseAquiferReference(association.start_ref),
        passageEnd: parseAquiferReference(association.end_ref),
        resource: { id: 'aquifer-fr', name: 'Tyndale Open Study Notes', author: 'Tyndale House Publishers', sourceLanguage: 'en', license: 'CC-BY-SA-4.0' },
        source: { language: 'en', html: source.content, sha256: sha256(source.content), provenance: `Aquifer ${source.version}` },
        translation: translation ? { language: 'fr', html: translation.content, sha256: sha256(translation.content), provenance: `Aquifer ${translation.version}` } : null,
      }]
    })
    const entries = applyPublishedTranslations('aquifer-fr', sourceEntries, translationsByResource.get('aquifer-fr'))
    await writeChunks('aquifer-fr', entries)
    if (book % 10 === 0 || book === 66) process.stderr.write(`  Aquifer ${book}/66 livres\n`)
  }

  const waveManifest = await readJson(path.join(options.waveExport, 'manifest.json'))
  for (const resourceId of Object.keys(waveManifest.resources)) {
    process.stderr.write(`Découpage complet de ${resourceId}…\n`)
    const entries = await readJson(path.join(options.waveExport, `${resourceId}.json`))
    await writeChunks(resourceId, entries)
  }

  const bibleAnnoteeManifest = await readJson(path.join(options.bibleAnnoteeExport, 'manifest.json'))
  const bibleAnnoteeRaw = await readFile(path.join(options.bibleAnnoteeExport, 'bible-annotee.json'), 'utf8')
  if (sha256(bibleAnnoteeRaw) !== bibleAnnoteeManifest.corpus.sha256) throw new Error('Hash Bible Annotée invalide')
  process.stderr.write('Découpage complet de Bible Annotée…\n')
  await writeChunks('bible-annotee', JSON.parse(bibleAnnoteeRaw))

  const wave3Manifest = await readJson(path.join(options.wave3Export, 'manifest.json'))
  for (const [resourceId, resource] of Object.entries(wave3Manifest.resources).filter(([id]) => id !== 'tsk')) {
    const raw = await readFile(path.join(options.wave3Export, `${resourceId}.json`), 'utf8')
    if (sha256(raw) !== resource.outputSha256) throw new Error(`Hash vague 3 invalide : ${resourceId}`)
    process.stderr.write(`Découpage vague 3 de ${resourceId}…\n`)
    await writeChunks(resourceId, JSON.parse(raw))
  }

  const douayRheimsManifest = await readJson(path.join(options.douayRheimsExport, 'manifest.json'))
  const douayRheimsRaw = await readFile(path.join(options.douayRheimsExport, douayRheimsManifest.corpus.path), 'utf8')
  if (douayRheimsManifest.sourcePolicy !== 'accepted-as-published' || sha256(douayRheimsRaw) !== douayRheimsManifest.corpus.sha256) {
    throw new Error('Export Douay-Rheims invalide')
  }
  process.stderr.write('Découpage des annotations Douay-Rheims…\n')
  await writeChunks('douay-rheims-notes', JSON.parse(douayRheimsRaw))

  const serializedChapters = [...chapters.values()]
    .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
    .map(record => ({
      ...record,
      passages: [...record.passages].sort((left, right) => left.localeCompare(right, 'fr', { numeric: true })),
    }))
  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    format: 'chapter-json-v1',
    sourceRevision: {
      firestore: 'read-only snapshot',
      aquifer: 'd67935dcc1e81e1d6d40c5cdd8cf38addb107767',
      mhy: 'mhy-fr-mobile-source-v1',
      waves: sha256(JSON.stringify(waveManifest.resources)),
      bibleAnnotee: bibleAnnoteeManifest.corpus.sha256,
      wave3: sha256(JSON.stringify(Object.fromEntries(Object.entries(wave3Manifest.resources).map(([id, resource]) => [id, resource.outputSha256])))),
      douayRheims: douayRheimsManifest.corpus.sha256,
      publishedTranslations: translationRevisions,
    },
    resources: resourceCounts,
    chapters: serializedChapters,
  }
  await writeFile(path.join(options.output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
  const normalization = await normalizeLibraryScopes(options.output)
  process.stdout.write(`${JSON.stringify({ output: options.output, resources: resourceCounts, chapters: serializedChapters.length, normalization }, null, 2)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})
