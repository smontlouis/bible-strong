#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'docs/research/data/bible-project')
const PRESENTATION_DATA_PATH = path.join(DATA_DIR, 'presentation-data.js')
const CANONICAL_OUTPUT_PATH = path.join(DATA_DIR, 'transcript-index.json')
const CACHE_DIR = path.join(ROOT, '.scratch/generated/bible-project-transcripts/youtube')
const CONCURRENCY = Number(process.env.BIBLE_PROJECT_TRANSCRIPT_CONCURRENCY || 5)
const LIMIT_ARGUMENT = process.argv.find(argument => argument.startsWith('--limit='))
const LIMIT = LIMIT_ARGUMENT ? Number(LIMIT_ARGUMENT.split('=')[1]) : Infinity
if (LIMIT_ARGUMENT && (!Number.isInteger(LIMIT) || LIMIT < 1))
  throw new Error('--limit must be a positive integer')
const OUTPUT_PATH = Number.isFinite(LIMIT)
  ? path.join(ROOT, `.scratch/generated/bible-project-transcript-index.limit-${LIMIT}.json`)
  : CANONICAL_OUTPUT_PATH
const REFRESH = process.argv.includes('--refresh')

const mapLimit = async (items, limit, mapper) => {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

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

const transcriptFiles = async providerId => {
  const filenames = await readdir(CACHE_DIR)
  return filenames
    .filter(filename => filename.startsWith(`${providerId}.`) && filename.endsWith('.json3'))
    .sort()
}

const failureStatusPath = providerId => path.join(CACHE_DIR, `${providerId}.status.json`)

const readCachedFailure = async providerId => {
  if (REFRESH) return null
  try {
    return JSON.parse(await readFile(failureStatusPath(providerId), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const cacheFailure = async entry => {
  await writeFile(
    failureStatusPath(entry.providerId),
    `${JSON.stringify({ ...entry, cachedAt: new Date().toISOString() }, null, 2)}\n`
  )
}

const downloadTranscript = async video => {
  if (!REFRESH && (await transcriptFiles(video.id)).length) return
  await execFileAsync(
    'yt-dlp',
    [
      '--no-update',
      '--no-playlist',
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      video.language,
      '--sub-format',
      'json3',
      '--output',
      path.join(CACHE_DIR, '%(id)s.%(ext)s'),
      video.sourceUrl,
    ],
    { maxBuffer: 2 * 1024 * 1024, timeout: 90_000 }
  )
}

const normalizeSegmentText = value =>
  String(value || '')
    .replace(/\n/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()

const parseJson3 = async filename => {
  const body = JSON.parse(await readFile(path.join(CACHE_DIR, filename), 'utf8'))
  const segments = (body.events || []).flatMap(event => {
    const text = normalizeSegmentText((event.segs || []).map(segment => segment.utf8).join(''))
    if (!text) return []
    return [
      {
        startMs: Number(event.tStartMs || 0),
        durationMs: Number(event.dDurationMs || 0),
        text,
      },
    ]
  })
  const text = normalizeSegmentText(segments.map(segment => segment.text).join(' '))
  return { segments, text }
}

const indexVideo = async video => {
  if (!(await transcriptFiles(video.id)).length) {
    const cachedFailure = await readCachedFailure(video.id)
    if (cachedFailure) {
      const { cachedAt, ...entry } = cachedFailure
      return entry
    }
  }
  try {
    await downloadTranscript(video)
    const filenames = await transcriptFiles(video.id)
    if (!filenames.length) {
      const entry = {
        providerId: video.id,
        language: video.language,
        status: 'missing',
        source: null,
      }
      await cacheFailure(entry)
      return entry
    }
    const filename = filenames.find(item => item.includes(`.${video.language}.`)) || filenames[0]
    const transcript = await parseJson3(filename)
    const cachePath = path.relative(ROOT, path.join(CACHE_DIR, filename))
    return {
      providerId: video.id,
      language: video.language,
      status: transcript.text ? 'available' : 'empty',
      source: 'youtube-caption',
      cachePath,
      sha256: createHash('sha256').update(transcript.text).digest('hex'),
      segmentCount: transcript.segments.length,
      characterCount: transcript.text.length,
    }
  } catch (error) {
    const entry = {
      providerId: video.id,
      language: video.language,
      status: 'error',
      source: null,
      error: String(error?.stderr || error?.message || error)
        .trim()
        .slice(0, 500),
    }
    await cacheFailure(entry)
    return entry
  }
}

const main = async () => {
  await mkdir(CACHE_DIR, { recursive: true })
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  const data = await readPresentationData()
  const candidates = researchCandidates(data).slice(0, LIMIT)
  process.stderr.write(`Acquiring transcripts for ${candidates.length} candidates...\n`)
  const entries = await mapLimit(candidates, CONCURRENCY, async (video, index) => {
    const entry = await indexVideo(video)
    process.stderr.write(
      `  ${index + 1}/${candidates.length} ${video.id} ${video.language} ${entry.status}\n`
    )
    return entry
  })
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: data.generatedAt,
    totals: {
      candidates: candidates.length,
      available: entries.filter(entry => entry.status === 'available').length,
      missing: entries.filter(entry => entry.status === 'missing').length,
      empty: entries.filter(entry => entry.status === 'empty').length,
      errors: entries.filter(entry => entry.status === 'error').length,
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
