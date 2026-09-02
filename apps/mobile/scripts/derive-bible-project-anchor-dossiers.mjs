#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createBibleReferenceParser } from '@bible-strong/bible-reference-parser/reference-parser'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'docs/research/data/bible-project')
const DOSSIER_DIR = path.join(ROOT, '.scratch/generated/bible-project-anchor-dossiers')
const PRESENTATION_DATA_PATH = path.join(DATA_DIR, 'presentation-data.js')
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json')
const TRANSCRIPT_INDEX_PATH = path.join(DATA_DIR, 'transcript-index.json')
const OUTPUT_PATH = path.join(DATA_DIR, 'anchor-dossier-index.json')

const OSIS_BOOKS = [
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
const BOOK_NUMBER_BY_OSIS = new Map(OSIS_BOOKS.map((book, index) => [book, index + 1]))

const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'))
const readPresentationData = async () => {
  const source = await readFile(PRESENTATION_DATA_PATH, 'utf8')
  const prefix = 'globalThis.BIBLE_PROJECT_PRESENTATION_DATA = '
  if (!source.startsWith(prefix)) throw new Error('Unexpected presentation data wrapper')
  return JSON.parse(source.slice(prefix.length))
}

const researchCandidates = data => {
  const rejectedIds = new Set(data.excludedVideos.map(video => video.id))
  const placedIds = new Set(
    data.works.flatMap(work => work.editions.map(edition => edition.providerId))
  )
  return data.inventory.filter(video => !rejectedIds.has(video.id) && !placedIds.has(video.id))
}

const createParser = language => {
  const parser = createBibleReferenceParser(language)
  return parser
}

const parsers = { en: createParser('en'), fr: createParser('fr') }

const parseJson3 = async cachePath => {
  const body = await readJson(path.join(ROOT, cachePath))
  const segments = (body.events || []).flatMap(event => {
    const text = String((event.segs || []).map(segment => segment.utf8).join(''))
      .replace(/\n/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
    if (!text) return []
    return [{ startMs: Number(event.tStartMs || 0), text }]
  })
  return {
    segments,
    text: segments
      .map(segment => segment.text)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim(),
  }
}

const osisTarget = osis => {
  const [startReference, endReference] = osis.split('-')
  const [book, chapterStart, verseStart] = startReference.split('.')
  const [endBook, chapterEnd, verseEnd] = (endReference || startReference).split('.')
  const bookNumber = BOOK_NUMBER_BY_OSIS.get(book)
  if (!bookNumber || endBook !== book) return null
  return {
    book: bookNumber,
    chapterStart: Number(chapterStart || 1),
    ...(verseStart ? { verseStart: Number(verseStart) } : {}),
    chapterEnd: Number(chapterEnd || chapterStart || 1),
    ...(verseEnd ? { verseEnd: Number(verseEnd) } : {}),
  }
}

const extractTranscriptReferences = (language, segments) => {
  const parser = parsers[language]
  const references = []
  for (let index = 0; index < segments.length; index += 3) {
    const window = segments.slice(Math.max(0, index - 1), index + 5)
    const text = window.map(segment => segment.text).join(' ')
    const parsed = parser.parse(text).osis_and_indices()
    for (const item of parsed) {
      const target = osisTarget(item.osis)
      if (!target) continue
      const [start, end] = item.indices
      references.push({
        osis: item.osis,
        target,
        matchedText: text.slice(start, end),
        timestampSeconds: Math.floor((window[0]?.startMs || 0) / 1000),
        context: text.slice(Math.max(0, start - 120), Math.min(text.length, end + 180)).trim(),
      })
    }
  }
  const seen = new Set()
  return references.filter(reference => {
    const key = `${reference.osis}:${Math.floor(reference.timestampSeconds / 20)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const summarizeReferences = references => {
  const groups = new Map()
  for (const reference of references) {
    const current = groups.get(reference.osis) || {
      osis: reference.osis,
      target: reference.target,
      mentions: 0,
      firstTimestampSeconds: reference.timestampSeconds,
      evidence: [],
    }
    current.mentions += 1
    if (current.evidence.length < 3)
      current.evidence.push({
        timestampSeconds: reference.timestampSeconds,
        matchedText: reference.matchedText,
        context: reference.context,
      })
    groups.set(reference.osis, current)
  }
  return [...groups.values()]
    .sort(
      (left, right) =>
        right.mentions - left.mentions || left.firstTimestampSeconds - right.firstTimestampSeconds
    )
    .slice(0, 20)
}

const lexicalSignals = segments =>
  segments
    .filter(segment =>
      /\b(?:hebrew|greek|aramaic)\b|\b(?:hébreu|grec|araméen)\b|\b[HG]\d{3,5}\b/iu.test(
        segment.text
      )
    )
    .slice(0, 20)
    .map(segment => ({
      timestampSeconds: Math.floor(segment.startMs / 1000),
      text: segment.text,
    }))

const introExcerpt = text => text.slice(0, 3_500)
const conclusionExcerpt = text => text.slice(Math.max(0, text.length - 1_500))

const main = async () => {
  await mkdir(DOSSIER_DIR, { recursive: true })
  const [presentation, catalog, transcriptIndex] = await Promise.all([
    readPresentationData(),
    readJson(CATALOG_PATH),
    readJson(TRANSCRIPT_INDEX_PATH),
  ])
  const catalogById = new Map(catalog.videos.map(video => [video.id, video]))
  const transcriptById = new Map(transcriptIndex.entries.map(entry => [entry.providerId, entry]))
  const candidates = researchCandidates(presentation)
  if (transcriptIndex.sourceGeneratedAt !== presentation.generatedAt)
    throw new Error(
      `Transcript index source ${transcriptIndex.sourceGeneratedAt} does not match presentation source ${presentation.generatedAt}`
    )
  const candidateIds = new Set(candidates.map(candidate => candidate.id))
  const missingTranscriptIds = [...candidateIds].filter(id => !transcriptById.has(id))
  const unexpectedTranscriptIds = [...transcriptById.keys()].filter(id => !candidateIds.has(id))
  if (missingTranscriptIds.length || unexpectedTranscriptIds.length)
    throw new Error(
      `Transcript index coverage mismatch; missing=${missingTranscriptIds.join(',')} unexpected=${unexpectedTranscriptIds.join(',')}`
    )
  const entries = []
  for (const [index, candidate] of candidates.entries()) {
    const catalogVideo = catalogById.get(candidate.id)
    const transcriptEntry = transcriptById.get(candidate.id)
    const transcript =
      transcriptEntry?.status === 'available'
        ? await parseJson3(transcriptEntry.cachePath)
        : { segments: [], text: '' }
    if (
      transcriptEntry?.status === 'available' &&
      createHash('sha256').update(transcript.text).digest('hex') !== transcriptEntry.sha256
    )
      throw new Error(`${candidate.id} transcript cache does not match its indexed SHA-256`)
    const references = extractTranscriptReferences(candidate.language, transcript.segments)
    const referenceSummary = summarizeReferences(references)
    const dossier = {
      schemaVersion: 1,
      providerId: candidate.id,
      language: candidate.language,
      title: candidate.title,
      category: candidate.category,
      sourceUrl: candidate.sourceUrl,
      durationSeconds: candidate.durationSeconds,
      description: catalogVideo?.description || '',
      playlists: catalogVideo?.playlists || [],
      localizedCounterpartIds: candidate.localizedCounterpartIds || [],
      metadataSignals: {
        bookMentions: catalogVideo?.bookMentions || [],
        referenceMentions: catalogVideo?.referenceMentions || [],
        planOccurrences: catalogVideo?.planOccurrences || [],
      },
      transcript: {
        status: transcriptEntry?.status || 'missing-index',
        source: transcriptEntry?.source || null,
        sha256: transcriptEntry?.sha256 || null,
        text: transcript.text,
        segments: transcript.segments,
      },
      extractedSignals: {
        transcriptReferences: referenceSummary,
        lexicalSignals: lexicalSignals(transcript.segments),
        introExcerpt: introExcerpt(transcript.text),
        conclusionExcerpt: conclusionExcerpt(transcript.text),
      },
    }
    const dossierPath = path.join(DOSSIER_DIR, `${candidate.id}.json`)
    await writeFile(dossierPath, `${JSON.stringify(dossier, null, 2)}\n`)
    entries.push({
      providerId: candidate.id,
      language: candidate.language,
      title: candidate.title,
      category: candidate.category,
      durationSeconds: candidate.durationSeconds,
      dossierPath: path.relative(ROOT, dossierPath),
      transcriptStatus: dossier.transcript.status,
      transcriptCharacterCount: dossier.transcript.text.length,
      metadataBookMentions: dossier.metadataSignals.bookMentions,
      metadataReferenceCount: dossier.metadataSignals.referenceMentions.length,
      transcriptReferenceCount: references.length,
      topTranscriptReferences: referenceSummary.slice(0, 5),
      lexicalSignalCount: dossier.extractedSignals.lexicalSignals.length,
    })
    process.stderr.write(`  ${index + 1}/${candidates.length} ${candidate.id}\n`)
  }
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: presentation.generatedAt,
    transcriptIndexGeneratedAt: transcriptIndex.generatedAt,
    totals: {
      candidates: entries.length,
      withTranscript: entries.filter(entry => entry.transcriptStatus === 'available').length,
      withTranscriptReferences: entries.filter(entry => entry.transcriptReferenceCount > 0).length,
      withMetadataReferences: entries.filter(entry => entry.metadataReferenceCount > 0).length,
      withLexicalSignals: entries.filter(entry => entry.lexicalSignalCount > 0).length,
    },
    entries,
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
  process.stderr.write(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
