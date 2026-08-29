#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CROSSWIRE_RESOURCES,
  RASHI_BOOKS,
  normalizeSourceMarkup,
  parseImp,
  selectRashiEditions,
  sha256,
} from './wave-sources.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')

const parseArguments = argv => {
  const options = {
    crosswireRoot: path.join(prototypeRoot, '.local/sources/crosswire/installed'),
    mod2imp: path.join(prototypeRoot, '.local/tools/sword-1.9.0/utilities/.libs/mod2imp'),
    sefariaBooks: path.join(prototypeRoot, '.local/sources/sefaria/books.json'),
    sefariaCache: path.join(prototypeRoot, '.local/sources/sefaria/rashi'),
    output: path.join(prototypeRoot, '.local/wave-export'),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--crosswire-root') options.crosswireRoot = path.resolve(argv[++index])
    else if (argument === '--mod2imp') options.mod2imp = path.resolve(argv[++index])
    else if (argument === '--sefaria-books') options.sefariaBooks = path.resolve(argv[++index])
    else if (argument === '--sefaria-cache') options.sefariaCache = path.resolve(argv[++index])
    else if (argument === '--output') options.output = path.resolve(argv[++index])
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  return options
}

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const confValue = (configuration, name) => configuration.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? null

const loadRemoteJson = async (url, cachePath) => {
  try {
    return await readJson(cachePath)
  } catch {
    const response = await fetch(encodeURI(url))
    if (!response.ok) throw new Error(`Téléchargement Sefaria impossible (${response.status}) : ${url}`)
    const text = await response.text()
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, text)
    return JSON.parse(text)
  }
}

const flattenRashiText = ({ document, edition }) => {
  if (document.license !== 'CC-BY') {
    throw new Error(`${edition.title} utilise une licence inattendue : ${document.license ?? 'absente'}`)
  }
  const entries = []
  for (let chapterIndex = 0; chapterIndex < document.text.length; chapterIndex += 1) {
    const chapter = document.text[chapterIndex]
    if (!Array.isArray(chapter)) continue
    for (let verseIndex = 0; verseIndex < chapter.length; verseIndex += 1) {
      const comments = Array.isArray(chapter[verseIndex]) ? chapter[verseIndex] : [chapter[verseIndex]]
      for (let commentIndex = 0; commentIndex < comments.length; commentIndex += 1) {
        const html = normalizeSourceMarkup(comments[commentIndex])
        if (!html.replace(/<[^>]*>/g, '').trim()) continue
        const passage = `${edition.book}-${chapterIndex + 1}-${verseIndex + 1}`
        entries.push({
          schemaVersion: 1,
          id: `rashi-en:${edition.book}:${chapterIndex + 1}:${verseIndex + 1}:${commentIndex + 1}`,
          passage,
          resource: { id: 'rashi-en', name: 'Rashi on Tanakh', author: 'Rachi', sourceLanguage: 'en', license: 'CC-BY' },
          source: {
            language: 'en',
            html,
            sha256: sha256(html),
            provenance: `Sefaria · ${document.versionTitle} · ${document.license}`,
          },
          translation: null,
        })
      }
    }
  }
  return entries
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  await mkdir(options.output, { recursive: true })
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceIndexes: { sefariaBooksSha256: sha256(await readFile(options.sefariaBooks)) },
    resources: {},
  }

  for (const resource of CROSSWIRE_RESOURCES) {
    process.stderr.write(`Export CrossWire ${resource.module}…\n`)
    const raw = execFileSync(options.mod2imp, [resource.module], {
      encoding: 'utf8',
      env: { ...process.env, SWORD_PATH: options.crosswireRoot },
      maxBuffer: 1024 * 1024 * 1024,
    })
    const entries = parseImp(raw, resource)
    const payload = `${JSON.stringify(entries)}\n`
    const outputPath = path.join(options.output, `${resource.id}.json`)
    await writeFile(outputPath, payload)
    const configuration = await readFile(path.join(options.crosswireRoot, 'mods.d', `${resource.module.toLowerCase()}.conf`), 'utf8')
    const archive = path.join(path.dirname(options.crosswireRoot), `${resource.module}.zip`)
    manifest.resources[resource.id] = {
      provider: 'CrossWire',
      module: resource.module,
      moduleVersion: confValue(configuration, 'Version'),
      moduleDate: confValue(configuration, 'SwordVersionDate'),
      distributionLicense: confValue(configuration, 'DistributionLicense'),
      textSource: confValue(configuration, 'TextSource'),
      archiveSha256: sha256(await readFile(archive)),
      entryCount: entries.length,
      outputSha256: sha256(payload),
    }
  }

  const booksIndex = await readJson(options.sefariaBooks)
  const editions = selectRashiEditions(booksIndex.books)
  const rashiEntries = []
  const rashiEditions = []
  for (const edition of editions) {
    const cachePath = path.join(options.sefariaCache, `${String(edition.book).padStart(2, '0')}.json`)
    const document = await loadRemoteJson(edition.json_url, cachePath)
    const entries = flattenRashiText({ document, edition })
    rashiEntries.push(...entries)
    rashiEditions.push({
      book: edition.book,
      title: edition.title,
      versionTitle: document.versionTitle,
      versionSource: document.versionSource,
      license: document.license,
      sourceSha256: sha256(await readFile(cachePath)),
      entryCount: entries.length,
    })
    process.stderr.write(`  Rachi ${edition.book}/${RASHI_BOOKS.size} : ${entries.length} unités\n`)
  }
  const rashiPayload = `${JSON.stringify(rashiEntries)}\n`
  await writeFile(path.join(options.output, 'rashi-en.json'), rashiPayload)
  manifest.resources['rashi-en'] = {
    provider: 'Sefaria',
    entryCount: rashiEntries.length,
    outputSha256: sha256(rashiPayload),
    editions: rashiEditions,
  }

  await writeFile(path.join(options.output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(manifest.resources, null, 2)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})
