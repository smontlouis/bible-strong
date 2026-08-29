import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import {
  assertResourcePublicationArtifact,
  decodeResourcePublicationEnvelope,
  isNonEmptyString,
  isNonNegativeInteger,
  isRecord,
  resolveResourcePublicationPath,
  sha256ResourcePublicationFile,
} from './resourcePublicationEnvelope.js'

const execFileAsync = promisify(execFile)
type Language = 'fr' | 'en'
type TimelineRelated = { slug: string; title: string }
type TimelineImage = { caption: string; file: string }
type TimelineVideo = { title: string; caption: string; filename: string }
export type TimelineEvent = {
  id: string
  slug: string
  title: string
  description: string
  article: string
  period: string
  dates: string
  related: TimelineRelated[]
  images: TimelineImage[]
  videos: TimelineVideo[]
  scriptures: string[]
}
export type TimelineCanonical = {
  format: 'bible-strong-canonical-timeline'
  schemaVersion: 1
  resourceId: 'TIMELINE'
  language: Language
  revision: string
  sourceVersion: string
  sourceSha256: string
  events: TimelineEvent[]
}
export type TimelineMetadata = {
  language: Language
  sourceVersion: string
  rights: {
    holder: string
    termsReference: string
    attribution: string
    online: boolean
    offline: boolean
  }
  deliveryCapabilities: { onlineAccess: boolean; offlineDownload: boolean }
}
export type TimelineManifest = {
  format: 'bible-strong-resource-publication'
  schemaVersion: 1
  identity: { kind: 'timeline'; resourceId: 'TIMELINE'; language: Language }
  revision: string
  canonical: { path: string; mediaType: 'application/json'; schemaVersion: 1; sha256: string; bytes: number }
  offlineArtifact: { path: string; mediaType: 'application/zip'; entry: 'bible-timeline-events.json'; sha256: string; bytes: number; contentSha256: string }
  provenance: { generator: 'bible-lexicon-maker'; sourceVersion: string; sourceSha256: string; generatedAt: string }
  rights: TimelineMetadata['rights']
  deliveryCapabilities: TimelineMetadata['deliveryCapabilities']
  counts: { events: number; relations: number; scriptures: number }
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalize(v)]))
  }
  return value
}
const isLanguage = (value: unknown): value is Language => value === 'fr' || value === 'en'
const toString = (value: unknown) => (typeof value === 'string' ? value : '')
const toArray = <T>(value: unknown, map: (item: unknown) => T): T[] => Array.isArray(value) ? value.map(map) : []

const normalizeEvent = (value: unknown): TimelineEvent => {
  if (!isRecord(value)) throw new Error('timeline-publication-event-invalid')
  const related = toArray(value.related, item => {
    if (!isRecord(item) || !isNonEmptyString(item.slug) || !isNonEmptyString(item.title)) throw new Error('timeline-publication-relation-invalid')
    return { slug: item.slug, title: item.title }
  })
  const images = toArray(value.images, item => {
    if (!isRecord(item) || !isNonEmptyString(item.file) || typeof item.caption !== 'string') throw new Error('timeline-publication-image-invalid')
    return { caption: item.caption, file: item.file }
  })
  const videos = toArray(value.videos, item => {
    if (!isRecord(item) || !isNonEmptyString(item.filename) || typeof item.title !== 'string' || typeof item.caption !== 'string') throw new Error('timeline-publication-video-invalid')
    return { title: item.title, caption: item.caption, filename: item.filename }
  })
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.slug) || !isNonEmptyString(value.title)) throw new Error('timeline-publication-event-invalid')
  return {
    id: value.id,
    slug: value.slug,
    title: value.title,
    description: toString(value.description),
    article: toString(value.article),
    period: toString(value.period),
    dates: toString(value.dates ?? value.date),
    related,
    images,
    videos,
    scriptures: toArray(value.scriptures, item => {
      if (typeof item !== 'string') throw new Error('timeline-publication-scripture-invalid')
      return item
    }),
  }
}

const readSource = async (sourcePath: string, language: Language) => {
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown
  if (!Array.isArray(source) || source.length === 0) throw new Error('timeline-publication-source-empty')
  const events = source.map(normalizeEvent)
  const bySlug = new Map<string, TimelineEvent>()
  for (const event of events) {
    const existing = bySlug.get(event.slug)
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      throw new Error('timeline-publication-event-duplicate')
    }
    bySlug.set(event.slug, event)
  }
  return { language, events: [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug)) }
}

const decodeCanonical = (value: unknown): TimelineCanonical => {
  if (!isRecord(value) || value.format !== 'bible-strong-canonical-timeline' || value.schemaVersion !== 1 || value.resourceId !== 'TIMELINE' || !isLanguage(value.language) || !isNonEmptyString(value.revision) || !isNonEmptyString(value.sourceVersion) || !/^[a-f0-9]{64}$/u.test(String(value.sourceSha256)) || !Array.isArray(value.events) || value.events.length === 0) throw new Error('timeline-publication-canonical-invalid')
  return value as unknown as TimelineCanonical
}

const deriveRevision = (canonical: Pick<TimelineCanonical, 'language' | 'events'>) => `timeline-${canonical.language}-${sha256(JSON.stringify(normalize(canonical.events))).slice(0, 20)}`
const counts = (events: TimelineEvent[]) => ({
  events: events.length,
  relations: events.reduce((total, event) => total + event.related.length, 0),
  scriptures: events.reduce((total, event) => total + event.scriptures.length, 0),
})

const validateMetadata = (metadata: TimelineMetadata) => {
  if (!isLanguage(metadata.language) || !metadata.sourceVersion.trim() || !metadata.rights.holder.trim() || !metadata.rights.termsReference.trim() || !metadata.rights.attribution.trim() || (!metadata.deliveryCapabilities.onlineAccess && !metadata.deliveryCapabilities.offlineDownload)) throw new Error('timeline-publication-metadata-invalid')
  if ((metadata.deliveryCapabilities.onlineAccess && !metadata.rights.online) || (metadata.deliveryCapabilities.offlineDownload && !metadata.rights.offline)) throw new Error('timeline-publication-rights-mismatch')
}

const zipSingle = async (sourcePath: string, outputPath: string) => {
  await execFileAsync('zip', ['-q', '-X', '-j', outputPath, sourcePath])
}

export const buildTimelineResourcePublication = async (options: TimelineMetadata & { sourcePath: string; outputDir: string; generatedAt?: string }) => {
  validateMetadata(options)
  const sourcePath = path.resolve(options.sourcePath)
  const outputDir = path.resolve(options.outputDir)
  if (!existsSync(sourcePath) || existsSync(outputDir)) throw new Error('timeline-publication-path-invalid')
  const sourceSha256 = await sha256ResourcePublicationFile(sourcePath)
  const source = await readSource(sourcePath, options.language)
  const baseCanonical = { format: 'bible-strong-canonical-timeline' as const, schemaVersion: 1 as const, resourceId: 'TIMELINE' as const, language: options.language, sourceVersion: options.sourceVersion, sourceSha256, events: source.events }
  const revision = deriveRevision(baseCanonical)
  const canonical: TimelineCanonical = { ...baseCanonical, revision }
  const staging = await mkdtemp(path.join(tmpdir(), 'timeline-publication-'))
  try {
    const canonicalDir = path.join(staging, 'canonical')
    const offlineDir = path.join(staging, 'offline')
    await mkdir(canonicalDir, { recursive: true })
    await mkdir(offlineDir, { recursive: true })
    const canonicalPath = path.join(canonicalDir, `timeline-${options.language}.json`)
    const contentPath = path.join(staging, 'bible-timeline-events.json')
    await writeFile(canonicalPath, `${JSON.stringify(canonical, null, 2)}\n`)
    await writeFile(contentPath, `${JSON.stringify(source.events)}\n`)
    const archivePath = path.join(offlineDir, 'bible-timeline-events.json.zip')
    await zipSingle(contentPath, archivePath)
    const [canonicalStat, archiveStat, contentStat] = await Promise.all([stat(canonicalPath), stat(archivePath), stat(contentPath)])
    const manifest: TimelineManifest = {
      format: 'bible-strong-resource-publication', schemaVersion: 1,
      identity: { kind: 'timeline', resourceId: 'TIMELINE', language: options.language }, revision,
      canonical: { path: `canonical/timeline-${options.language}.json`, mediaType: 'application/json', schemaVersion: 1, sha256: await sha256ResourcePublicationFile(canonicalPath), bytes: canonicalStat.size },
      offlineArtifact: { path: 'offline/bible-timeline-events.json.zip', mediaType: 'application/zip', entry: 'bible-timeline-events.json', sha256: await sha256ResourcePublicationFile(archivePath), bytes: archiveStat.size, contentSha256: await sha256ResourcePublicationFile(contentPath) },
      provenance: { generator: 'bible-lexicon-maker', sourceVersion: options.sourceVersion, sourceSha256, generatedAt: options.generatedAt ?? new Date().toISOString() },
      rights: options.rights, deliveryCapabilities: options.deliveryCapabilities, counts: counts(source.events),
    }
    await writeFile(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    if (contentStat.size <= 0) throw new Error('timeline-publication-content-empty')
    await validateTimelineResourcePublication(staging)
    await mkdir(path.dirname(outputDir), { recursive: true })
    await rename(staging, outputDir)
    return { outputDir, manifest }
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

export const validateTimelineResourcePublication = async (bundleDir: string) => {
  const root = path.resolve(bundleDir)
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')) as TimelineManifest
  if (manifest.format !== 'bible-strong-resource-publication' || manifest.identity.kind !== 'timeline' || manifest.identity.resourceId !== 'TIMELINE' || !isLanguage(manifest.identity.language) || manifest.offlineArtifact.entry !== 'bible-timeline-events.json') throw new Error('timeline-publication-manifest-invalid')
  const canonicalPath = resolveResourcePublicationPath(root, manifest.canonical.path)
  const archivePath = resolveResourcePublicationPath(root, manifest.offlineArtifact.path)
  await assertResourcePublicationArtifact(canonicalPath, manifest.canonical, 'timeline-canonical', root)
  await assertResourcePublicationArtifact(archivePath, manifest.offlineArtifact, 'timeline-offline', root)
  const canonical = decodeCanonical(JSON.parse(await readFile(canonicalPath, 'utf8')))
  if (canonical.language !== manifest.identity.language || canonical.revision !== manifest.revision || deriveRevision(canonical) !== manifest.revision || canonical.sourceVersion !== manifest.provenance.sourceVersion || canonical.sourceSha256 !== manifest.provenance.sourceSha256 || JSON.stringify(counts(canonical.events)) !== JSON.stringify(manifest.counts)) throw new Error('timeline-publication-declaration-mismatch')
  const extracted = await mkdtemp(path.join(tmpdir(), 'timeline-validate-'))
  try {
    await execFileAsync('unzip', ['-qq', archivePath, manifest.offlineArtifact.entry, '-d', extracted])
    const contentPath = path.join(extracted, manifest.offlineArtifact.entry)
    const content = JSON.parse(await readFile(contentPath, 'utf8')) as unknown
    const events = Array.isArray(content) ? content.map(normalizeEvent).sort((a, b) => a.slug.localeCompare(b.slug)) : []
    if (sha256(JSON.stringify(content) + '\n') !== manifest.offlineArtifact.contentSha256 || JSON.stringify(events) !== JSON.stringify(canonical.events)) throw new Error('timeline-publication-offline-mismatch')
  } finally { await rm(extracted, { recursive: true, force: true }) }
  return manifest
}

const parseArgs = (args: readonly string[]) => Object.fromEntries(args.reduce<string[][]>((pairs, value, index, all) => index % 2 === 0 ? [...pairs, [value, all[index + 1] ?? '']] : pairs, []))
const main = async () => {
  const [command = 'build', ...raw] = process.argv.slice(2)
  const args = parseArgs(raw)
  if (command === 'validate') { console.log(JSON.stringify(await validateTimelineResourcePublication(args['--bundle']), null, 2)); return }
  const metadata = JSON.parse(await readFile(path.resolve(args['--metadata']), 'utf8')) as Omit<TimelineMetadata, 'language'>
  const result = await buildTimelineResourcePublication({ ...metadata, language: args['--language'] as Language, sourcePath: args['--source'], outputDir: args['--output-dir'] })
  console.log(JSON.stringify({ language: result.manifest.identity.language, revision: result.manifest.revision }, null, 2))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1 })
