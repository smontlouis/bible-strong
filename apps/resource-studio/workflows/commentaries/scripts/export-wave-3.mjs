#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseImp, sha256 } from './wave-sources.mjs'
import { MHM_CHAPTERS, MHM_RESOURCE, WAVE_3_CROSSWIRE_RESOURCES, confValue, parseMhmChapter } from './wave-3-sources.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const parseArguments = argv => {
  const options = {
    cache: path.join(prototypeRoot, '.local/sources/wave-3'),
    installed: path.join(prototypeRoot, '.local/sources/wave-3/installed'),
    output: path.join(prototypeRoot, '.local/wave-3-export'),
    mod2imp: path.join(prototypeRoot, '.local/tools/sword-1.9.0/utilities/.libs/mod2imp'),
    concurrency: 6,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--cache') options.cache = path.resolve(argv[++index])
    else if (argument === '--installed') options.installed = path.resolve(argv[++index])
    else if (argument === '--output') options.output = path.resolve(argv[++index])
    else if (argument === '--mod2imp') options.mod2imp = path.resolve(argv[++index])
    else if (argument === '--concurrency') options.concurrency = Number(argv[++index])
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  return options
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const fetchCached = async ({ url, cachePath, json = false }) => {
  try {
    const bytes = await readFile(cachePath)
    return { bytes, cacheHit: true }
  } catch {}
  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'BibleStrongCommentaryAudit/1.0 (+https://bible-strong.app)', accept: json ? 'application/json' : '*/*' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      await mkdir(path.dirname(cachePath), { recursive: true })
      await writeFile(cachePath, bytes)
      return { bytes, cacheHit: false }
    } catch (error) {
      lastError = error
      if (attempt < 4) await delay(attempt * 500)
    }
  }
  throw new Error(`Téléchargement impossible : ${url} (${lastError?.message})`)
}

const runPool = async ({ items, concurrency, worker }) => {
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) await worker(items[cursor++])
  }))
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  await mkdir(options.output, { recursive: true })
  await mkdir(options.installed, { recursive: true })
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    wave: 3,
    authorization: {
      status: 'confirmed-by-project-owner',
      confirmedAt: '2026-08-28',
      scope: 'Le responsable Bible Strong confirme avoir obtenu de STEP et des auteurs les droits nécessaires à l’usage, la transformation et la redistribution des ressources de cette vague.',
    },
    resources: {},
    exclusions: {
      TNotes: 'Même œuvre que Tyndale Open Study Notes déjà importée depuis le dépôt officiel Aquifer ; emballage STEP non dupliqué.',
      Spurious: 'Appareil sur les passages contestés du Nouveau Testament, distinct d’un commentaire biblique.',
    },
    nonCommentaryResources: {
      TSK: 'Corpus de références croisées déjà distribué par Bible Strong sous l’identité TRESOR ; conservé dans l’audit source mais exclu du lecteur de commentaires.',
    },
  }

  process.stderr.write(`Téléchargement de ${WAVE_3_CROSSWIRE_RESOURCES.length} modules CrossWire…\n`)
  await runPool({
    items: WAVE_3_CROSSWIRE_RESOURCES,
    concurrency: Math.min(options.concurrency, 4),
    worker: async resource => {
      const archivePath = path.join(options.cache, 'crosswire', `${resource.module}.zip`)
      const url = `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/${resource.module}.zip`
      const fetched = await fetchCached({ url, cachePath: archivePath })
      execFileSync('unzip', ['-oq', archivePath, '-d', options.installed])
      resource.archive = { url, path: archivePath, sha256: sha256(fetched.bytes), byteLength: fetched.bytes.length }
      process.stderr.write(`  ${resource.module}${fetched.cacheHit ? ' (cache)' : ''}\n`)
    },
  })

  for (const resource of WAVE_3_CROSSWIRE_RESOURCES) {
    process.stderr.write(`Export CrossWire ${resource.module}…\n`)
    const raw = execFileSync(options.mod2imp, [resource.module], {
      encoding: 'utf8',
      env: { ...process.env, SWORD_PATH: options.installed },
      maxBuffer: 1024 * 1024 * 1024,
    })
    const entries = parseImp(raw, resource)
    if (entries.length === 0) throw new Error(`${resource.module} n’a produit aucune unité`)
    const payload = `${JSON.stringify(entries)}\n`
    await writeFile(path.join(options.output, `${resource.id}.json`), payload)
    const configurationPath = path.join(options.installed, 'mods.d', `${resource.module.toLowerCase()}.conf`)
    const configuration = await readFile(configurationPath, 'utf8')
    manifest.resources[resource.id] = {
      provider: 'CrossWire',
      module: resource.module,
      title: resource.title,
      author: resource.author,
      language: resource.language,
      moduleVersion: confValue(configuration, 'Version'),
      moduleDate: confValue(configuration, 'SwordVersionDate'),
      declaredDistributionLicense: confValue(configuration, 'DistributionLicense'),
      textSource: confValue(configuration, 'TextSource'),
      bibleStrongAuthorization: 'confirmed-by-project-owner',
      archiveUrl: resource.archive.url,
      archiveSha256: resource.archive.sha256,
      entryCount: entries.length,
      chapterCount: new Set(entries.map(entry => entry.passage.split('-').slice(0, 2).join('-'))).size,
      outputSha256: sha256(payload),
    }
  }

  process.stderr.write(`Export STEP MHM : ${MHM_CHAPTERS.length} chapitres…\n`)
  const mhmEntries = []
  const mhmPages = []
  let mhmDone = 0
  await runPool({
    items: MHM_CHAPTERS,
    concurrency: options.concurrency,
    worker: async chapter => {
      const sourceUrl = `https://www.stepbible.org/rest/bible/getBibleText/MHM/${chapter.osisReference}`
      const cachePath = path.join(options.cache, 'step-mhm', String(chapter.book).padStart(2, '0'), `${chapter.chapter}.json`)
      const fetched = await fetchCached({ url: sourceUrl, cachePath, json: true })
      const document = JSON.parse(fetched.bytes.toString('utf8'))
      const entries = parseMhmChapter({ value: document.value, book: chapter.book, chapter: chapter.chapter, sourceUrl })
      if (entries.length === 0) throw new Error(`MHM vide : ${chapter.osisReference}`)
      mhmEntries.push(...entries)
      mhmPages.push({ reference: chapter.osisReference, url: sourceUrl, sha256: sha256(fetched.bytes), byteLength: fetched.bytes.length, entryCount: entries.length })
      mhmDone++
      if (mhmDone % 100 === 0 || mhmDone === MHM_CHAPTERS.length) process.stderr.write(`  MHM ${mhmDone}/${MHM_CHAPTERS.length}\n`)
    },
  })
  mhmEntries.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }))
  const mhmIds = new Set(mhmEntries.map(entry => entry.id))
  if (mhmIds.size !== mhmEntries.length) throw new Error(`MHM contient ${mhmEntries.length - mhmIds.size} identifiants dupliqués`)
  const mhmPayload = `${JSON.stringify(mhmEntries)}\n`
  await writeFile(path.join(options.output, 'mhm.json'), mhmPayload)
  mhmPages.sort((left, right) => left.reference.localeCompare(right.reference, 'en', { numeric: true }))
  manifest.resources.mhm = {
    provider: 'STEPBible',
    module: 'MHM',
    title: MHM_RESOURCE.title,
    author: MHM_RESOURCE.author,
    language: 'en',
    declaredDistributionLicense: 'CC BY 4.0',
    generatedWith: 'ChatGPT 4 par STEPBible en 2025',
    bibleStrongAuthorization: 'confirmed-by-project-owner',
    sourceInfoUrl: 'https://www.stepbible.org/version.jsp?version=MHM',
    entryCount: mhmEntries.length,
    chapterCount: MHM_CHAPTERS.length,
    outputSha256: sha256(mhmPayload),
    sourcePageInventorySha256: sha256(JSON.stringify(mhmPages)),
    sourcePages: mhmPages,
  }

  await writeFile(path.join(options.output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(Object.fromEntries(Object.entries(manifest.resources).map(([id, resource]) => [id, { entries: resource.entryCount, chapters: resource.chapterCount }])), null, 2)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})
