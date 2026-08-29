#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './wave-sources.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/sources/original-douay-rheims'))
const outputRoot = path.resolve(process.argv[3] ?? path.join(prototypeRoot, '.local/douay-rheims-export'))

const bookIds = {
  genesis: 1, exodus: 2, leviticus: 3, numbers: 4, deuteronomy: 5, josue: 6, judges: 7, ruth: 8,
  '1-kings': 9, '2-kings': 10, '3-kings': 11, '4-kings': 12,
  '1-paralipomenon': 13, '2-paralipomenon': 14, '1-esdras': 15, '2-esdras': 16,
  esther: 17, job: 18, psalms: 19, proverbs: 20, ecclesiastes: 21, 'canticle-of-canticles': 22,
  isaie: 23, jeremie: 24, lamentations: 25, ezechiel: 26, daniel: 27, osee: 28, joel: 29,
  amos: 30, abdias: 31, jonas: 32, micheas: 33, nahum: 34, habacuc: 35, sophonias: 36,
  aggeus: 37, zacharias: 38, malachie: 39, matthew: 40, mark: 41, luke: 42, john: 43,
  acts: 44, romans: 45, '1-corinthians': 46, '2-corinthians': 47, galatians: 48,
  ephesians: 49, philippians: 50, colossians: 51, '1-thessalonians': 52, '2-thessalonians': 53,
  '1-timothy': 54, '2-timothy': 55, titus: 56, philemon: 57, hebrews: 58, james: 59,
  '1-peter': 60, '2-peter': 61, '1-john': 62, '2-john': 63, '3-john': 64, jude: 65,
  apocalypse: 66, tobias: 67, judith: 68, wisdom: 69, ecclesiasticus: 70, baruch: 71,
  '1-machabees': 72, '2-machabees': 73,
}

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const annotationHtml = annotation => {
  const title = annotation.title ? `<h4>${escapeHtml(annotation.title)}</h4>` : ''
  const body = String(annotation.text ?? '').split(/\n\s*\n/).filter(Boolean).map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('')
  const notes = annotation.notes?.length
    ? `<ul>${annotation.notes.map(note => `<li><strong>${escapeHtml(note.marker)}</strong> ${note.text}</li>`).join('')}</ul>`
    : ''
  return `${title}${body}${notes}`
}

const annotationsRoot = path.join(sourceRoot, 'annotations')
const commit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const slugs = (await readdir(annotationsRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()
const entries = []
const chapterKeys = new Set()
const importedBooks = new Set()

for (const slug of slugs) {
  const book = bookIds[slug]
  if (!book) throw new Error(`Livre Douay-Rheims inconnu : ${slug}`)
  const filenames = (await readdir(path.join(annotationsRoot, slug))).filter(filename => filename.endsWith('.json')).sort()
  for (const filename of filenames) {
    const relativeSourcePath = `annotations/${slug}/${filename}`
    const document = JSON.parse(await readFile(path.join(sourceRoot, relativeSourcePath), 'utf8'))
    if (!Number.isInteger(document.chapter) || !Array.isArray(document.annotations)) throw new Error(`JSON Douay-Rheims invalide : ${relativeSourcePath}`)
    for (let index = 0; index < document.annotations.length; index += 1) {
      const annotation = document.annotations[index]
      if (!Number.isInteger(annotation.verse)) throw new Error(`Verset Douay-Rheims invalide : ${relativeSourcePath}`)
      const passage = `${book}-${document.chapter}-${annotation.verse}`
      const html = annotationHtml(annotation)
      entries.push({
        schemaVersion: 1,
        id: `douay-rheims-notes:${slug}:${String(document.chapter).padStart(3, '0')}:${String(annotation.verse).padStart(3, '0')}:${String(index + 1).padStart(3, '0')}`,
        passage,
        resource: {
          id: 'douay-rheims-notes',
          name: 'Original Douay–Rheims Annotations',
          author: 'Collège anglais de Douai–Reims',
          sourceLanguage: 'en',
          license: 'CC0-1.0',
        },
        source: {
          language: 'en',
          html,
          sha256: sha256(html),
          provenance: `janvier-s/original-douay-rheims@${commit}:${relativeSourcePath}`,
        },
        translation: null,
      })
      chapterKeys.add(`${book}-${document.chapter}`)
      importedBooks.add(book)
    }
  }
}

entries.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }) || left.id.localeCompare(right.id, 'en', { numeric: true }))
const payload = `${JSON.stringify(entries)}\n`
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourcePolicy: 'accepted-as-published',
  provider: 'janvier-s/original-douay-rheims',
  repositoryUrl: 'https://github.com/janvier-s/original-douay-rheims',
  commit,
  licenseId: 'CC0-1.0',
  transformation: 'Conversion mécanique des objets JSON annotations vers le schéma JSON du prototype ; aucun rapprochement avec les fac-similés et aucune restauration éditoriale.',
  corpus: {
    path: 'douay-rheims-notes.json',
    sha256: sha256(payload),
    entryCount: entries.length,
    chapterCount: chapterKeys.size,
    bookCount: importedBooks.size,
  },
}

await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, manifest.corpus.path), payload),
  writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
])
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
