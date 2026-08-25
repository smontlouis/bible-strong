import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import {
  getSupportedOsisBookNumber,
  normalizeOsisReference,
} from '@bible-strong/bible-reference-parser/osis-reference'
import { persistThematicSearchImport } from '../repositories/topicIngestionRepository'
import { CONTROLLED_FRENCH_TOPIC_ALIASES } from './topicFrenchAliases'
import {
  makeHttpTopicEmbeddingProvider,
  normalizeTopicSearchText,
  TOPIC_EMBEDDING_CONTRACT,
  TOPIC_EMBEDDING_MODEL,
} from './topicEmbedding'

const PROJECT_ROOT = resolve(process.cwd())
const SOURCE_ROOT = resolve(
  process.env.RESOURCE_TOPIC_SOURCE_ROOT ??
    join(PROJECT_ROOT, '.local/topic-sources')
)
const REPORT_PATH = resolve(
  process.env.RESOURCE_TOPIC_REPORT_PATH ??
    join(PROJECT_ROOT, '.local/topic-import-report.json')
)
const NEUU_ROOT = join(SOURCE_ROOT, 'bible-topics-dataset')
const OPENBIBLE_ZIP = join(SOURCE_ROOT, 'openbible-topic-scores.zip')
const OPENBIBLE_SCORES = join(SOURCE_ROOT, 'topic-scores.txt')
const OPENBIBLE_VOTES = join(SOURCE_ROOT, 'openbible-topic-votes.txt')

const OPENBIBLE_SCORES_URL = 'https://a.openbible.info/data/topic-scores.zip'
const OPENBIBLE_VOTES_URL = 'https://a.openbible.info/data/topic-votes.txt'
const NEUU_REPOSITORY_URL = 'https://github.com/neuu-org/bible-topics-dataset.git'

type SourceCode = 'nave' | 'torrey' | 'openbible'

type Topic = {
  id: string
  canonicalName: string
  normalizedName: string
  sourceNames: Map<SourceCode, { key: string; name: string; version: string }>
  aliases: Map<string, Alias>
}

type Alias = {
  language: 'en' | 'fr'
  alias: string
  normalizedAlias: string
  method: string
  validationStatus: string
  isPreferred: boolean
}

type Passage = {
  topicId: string
  source: SourceCode
  book: number
  chapterStart: number
  verseStart: number
  chapterEnd: number
  verseEnd: number
  sourceScore?: number
  sourceVotes?: number
  provenance: Record<string, unknown>
}

type Relation = {
  topicId: string
  relatedTopicId: string
  relationType: 'see-also'
  source: SourceCode
}

type ParsedTopicFile = {
  topic: string
  slug: string
  canonical_id: string
  source: 'NAV' | 'TOR'
  see_also?: string[]
  biblical_references?: {
    book: string
    chapter: number
    verses: number[]
    raw: string
  }[]
}

type ImportReport = {
  runId: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  sourceVersions: Record<string, string>
  sourceSha256: Record<string, string>
  topicsImported: number
  aliasesImported: number
  passagesImported: Record<SourceCode, number>
  relationsImported: number
  duplicates: number
  referencesRejected: number
  unknownBooks: Record<string, number>
  canonConflicts: number
  databaseBytesBefore: number
  databaseBytesAfter?: number
  databaseBytesAdded?: number
  thematicStorageBytes?: number
}

const normalizeTopicName = (value: string) => normalizeTopicSearchText(value).replace(/\s+/g, '_')
const topicIdFor = (value: string) => `topic:${normalizeTopicName(value)}`
const titleCase = (value: string) =>
  value.toLocaleLowerCase().replace(/(^|[\s,;:()/-])\p{L}/gu, letter => letter.toLocaleUpperCase())

const sha256File = async (path: string) =>
  new Promise<string>((resolveHash, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolveHash(hash.digest('hex')))
  })

const download = async (url: string, path: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`)
  await writeFile(path, Buffer.from(await response.arrayBuffer()))
}

const ensureSources = async () => {
  await mkdir(SOURCE_ROOT, { recursive: true })
  if (!existsSync(NEUU_ROOT)) {
    execFileSync('git', ['clone', '--depth=1', NEUU_REPOSITORY_URL, NEUU_ROOT], {
      stdio: 'inherit',
    })
  }
  if (!existsSync(OPENBIBLE_ZIP)) await download(OPENBIBLE_SCORES_URL, OPENBIBLE_ZIP)
  if (!existsSync(OPENBIBLE_VOTES)) await download(OPENBIBLE_VOTES_URL, OPENBIBLE_VOTES)
  if (!existsSync(OPENBIBLE_SCORES)) {
    execFileSync('unzip', ['-o', OPENBIBLE_ZIP, 'topic-scores.txt', '-d', SOURCE_ROOT], {
      stdio: 'inherit',
    })
  }
}

const listJsonFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const path = join(root, entry.name)
      if (entry.isDirectory()) return listJsonFiles(path)
      return entry.isFile() && entry.name.endsWith('.json') && entry.name !== '_metadata.json'
        ? [path]
        : []
    })
  )
  return nested.flat()
}

const addAlias = (topic: Topic, alias: Omit<Alias, 'normalizedAlias'>) => {
  const normalizedAlias = normalizeTopicSearchText(alias.alias)
  if (!normalizedAlias) return false
  const key = `${alias.language}:${normalizedAlias}`
  const existing = topic.aliases.get(key)
  if (existing?.isPreferred && !alias.isPreferred) return false
  topic.aliases.set(key, { ...alias, normalizedAlias })
  return !existing
}

const ensureTopic = (
  topics: Map<string, Topic>,
  name: string,
  source: SourceCode,
  sourceKey: string,
  sourceVersion: string,
  report: ImportReport
) => {
  const normalizedName = normalizeTopicName(name)
  const id = topicIdFor(name)
  let topic = topics.get(id)
  if (!topic) {
    topic = {
      id,
      canonicalName: titleCase(name),
      normalizedName,
      sourceNames: new Map(),
      aliases: new Map(),
    }
    topics.set(id, topic)
  }
  const existingSource = topic.sourceNames.get(source)
  if (existingSource && (existingSource.key !== sourceKey || existingSource.name !== name)) {
    report.duplicates += 1
  }
  topic.sourceNames.set(source, { key: sourceKey, name, version: sourceVersion })
  addAlias(topic, {
    language: 'en',
    alias: titleCase(name),
    method: 'source-original',
    validationStatus: 'source',
    isPreferred: source === 'nave' || topic.aliases.size === 0,
  })
  return topic
}

const BOOK_NUMBER_BY_NAME = new Map(
  [
    'Genesis',
    'Exodus',
    'Leviticus',
    'Numbers',
    'Deuteronomy',
    'Joshua',
    'Judges',
    'Ruth',
    '1 Samuel',
    '2 Samuel',
    '1 Kings',
    '2 Kings',
    '1 Chronicles',
    '2 Chronicles',
    'Ezra',
    'Nehemiah',
    'Esther',
    'Job',
    'Psalms',
    'Proverbs',
    'Ecclesiastes',
    'Song of Solomon',
    'Isaiah',
    'Jeremiah',
    'Lamentations',
    'Ezekiel',
    'Daniel',
    'Hosea',
    'Joel',
    'Amos',
    'Obadiah',
    'Jonah',
    'Micah',
    'Nahum',
    'Habakkuk',
    'Zephaniah',
    'Haggai',
    'Zechariah',
    'Malachi',
    'Matthew',
    'Mark',
    'Luke',
    'John',
    'Acts',
    'Romans',
    '1 Corinthians',
    '2 Corinthians',
    'Galatians',
    'Ephesians',
    'Philippians',
    'Colossians',
    '1 Thessalonians',
    '2 Thessalonians',
    '1 Timothy',
    '2 Timothy',
    'Titus',
    'Philemon',
    'Hebrews',
    'James',
    '1 Peter',
    '2 Peter',
    '1 John',
    '2 John',
    '3 John',
    'Jude',
    'Revelation',
  ].map((name, index) => [name, index + 1] as const)
)

const contiguousRanges = (verses: readonly number[]) => {
  const sorted = [...new Set(verses)].filter(Number.isInteger).sort((a, b) => a - b)
  const ranges: [number, number][] = []
  sorted.forEach(verse => {
    const previous = ranges.at(-1)
    if (previous && previous[1] + 1 === verse) previous[1] = verse
    else ranges.push([verse, verse])
  })
  return ranges
}

const passageKey = (passage: Passage) =>
  [
    passage.topicId,
    passage.source,
    passage.book,
    passage.chapterStart,
    passage.verseStart,
    passage.chapterEnd,
    passage.verseEnd,
  ].join(':')

const addPassage = (passages: Map<string, Passage>, passage: Passage, report: ImportReport) => {
  const key = passageKey(passage)
  const existing = passages.get(key)
  if (!existing) {
    passages.set(key, passage)
    return
  }
  report.duplicates += 1
  if ((passage.sourceScore ?? -Infinity) > (existing.sourceScore ?? -Infinity)) {
    passages.set(key, passage)
  }
}

const readMetadataVersion = async (source: 'nave' | 'torrey') => {
  const metadata = JSON.parse(
    await readFile(join(NEUU_ROOT, 'data/02_sources', source, '_metadata.json'), 'utf8')
  ) as { version?: string }
  return metadata.version ?? 'unknown'
}

const importNeuuSource = async ({
  source,
  topics,
  passages,
  pendingRelations,
  report,
}: {
  source: 'nave' | 'torrey'
  topics: Map<string, Topic>
  passages: Map<string, Passage>
  pendingRelations: { from: string; to: string; source: SourceCode }[]
  report: ImportReport
}) => {
  const root = join(NEUU_ROOT, 'data/02_sources', source)
  const version = await readMetadataVersion(source)
  report.sourceVersions[source] = version
  for (const path of await listJsonFiles(root)) {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as ParsedTopicFile
    const topic = ensureTopic(topics, parsed.topic, source, parsed.slug, version, report)
    parsed.see_also?.forEach(related =>
      pendingRelations.push({ from: topic.id, to: topicIdFor(related), source })
    )
    if (source === 'nave') continue
    parsed.biblical_references?.forEach(reference => {
      const book = BOOK_NUMBER_BY_NAME.get(reference.book)
      if (!book) {
        report.unknownBooks[reference.book] = (report.unknownBooks[reference.book] ?? 0) + 1
        report.referencesRejected += 1
        return
      }
      contiguousRanges(reference.verses).forEach(([start, end]) =>
        addPassage(
          passages,
          {
            topicId: topic.id,
            source,
            book,
            chapterStart: reference.chapter,
            verseStart: start,
            chapterEnd: reference.chapter,
            verseEnd: end,
            provenance: { raw: reference.raw, canonicalId: parsed.canonical_id },
          },
          report
        )
      )
    })
  }
}

const parseOpenBibleOsis = (value: string) => {
  const normalized = normalizeOsisReference(value)
  const match = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-([1-3]?[A-Za-z]+)\.(\d+)\.(\d+))?$/.exec(
    normalized
  )
  if (!match) return undefined
  const [, startBook, startChapter, startVerse, endBook, endChapter, endVerse] = match
  const book = getSupportedOsisBookNumber(startBook)
  const resolvedEndBook = endBook ? getSupportedOsisBookNumber(endBook) : book
  if (!book || resolvedEndBook !== book) return undefined
  return {
    book,
    chapterStart: Number(startChapter),
    verseStart: Number(startVerse),
    chapterEnd: Number(endChapter ?? startChapter),
    verseEnd: Number(endVerse ?? startVerse),
  }
}

const openBibleVersion = async () => {
  const input = createReadStream(OPENBIBLE_SCORES)
  const lines = createInterface({ input, crlfDelay: Infinity })
  for await (const line of lines) {
    const match = /# Generated ([0-9-]+)/.exec(line)
    return match?.[1] ?? 'unknown'
  }
  return 'unknown'
}

const importOpenBible = async (
  topics: Map<string, Topic>,
  passages: Map<string, Passage>,
  report: ImportReport
) => {
  const version = await openBibleVersion()
  report.sourceVersions.openbible = version
  const selectedVoteKeys = new Map<string, Passage>()
  const lines = createInterface({ input: createReadStream(OPENBIBLE_SCORES), crlfDelay: Infinity })
  let first = true
  for await (const line of lines) {
    if (first) {
      first = false
      continue
    }
    const [name, osis, scoreValue] = line.split('\t')
    if (!name || !osis) continue
    const reference = parseOpenBibleOsis(osis)
    if (!reference) {
      report.referencesRejected += 1
      continue
    }
    const topic = ensureTopic(topics, name, 'openbible', normalizeTopicName(name), version, report)
    const passage: Passage = {
      topicId: topic.id,
      source: 'openbible',
      ...reference,
      sourceScore: Number(scoreValue) || 0,
      provenance: { osis },
    }
    addPassage(passages, passage, report)
    selectedVoteKeys.set(
      `${normalizeTopicSearchText(name)}:${reference.book}:${reference.chapterStart}:${reference.verseStart}:${reference.chapterEnd}:${reference.verseEnd}`,
      passage
    )
  }

  const votes = createInterface({ input: createReadStream(OPENBIBLE_VOTES), crlfDelay: Infinity })
  first = true
  for await (const line of votes) {
    if (first) {
      first = false
      continue
    }
    const [name, startId, endId, votesValue] = line.split('\t')
    if (!name || !/^\d{8}$/.test(startId)) continue
    const startNumber = Number(startId)
    const endNumber = /^\d{8}$/.test(endId) ? Number(endId) : startNumber
    const reference = {
      book: Math.floor(startNumber / 1_000_000),
      chapterStart: Math.floor((startNumber % 1_000_000) / 1_000),
      verseStart: startNumber % 1_000,
      chapterEnd: Math.floor((endNumber % 1_000_000) / 1_000),
      verseEnd: endNumber % 1_000,
    }
    const selected = selectedVoteKeys.get(
      `${normalizeTopicSearchText(name)}:${reference.book}:${reference.chapterStart}:${reference.verseStart}:${reference.chapterEnd}:${reference.verseEnd}`
    )
    if (selected) selected.sourceVotes = Number(votesValue) || 0
  }
}

const main = async () => {
  const started = performance.now()
  await ensureSources()
  const embeddingProvider = makeHttpTopicEmbeddingProvider(
    process.env.RESOURCE_TOPIC_EMBEDDING_URL ?? 'http://127.0.0.1:8791',
    { maxAttempts: 7 }
  )
  const sourceVersions = {
    neuuCommit: execFileSync('git', ['-C', NEUU_ROOT, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    topicEmbeddingModel: TOPIC_EMBEDDING_MODEL,
    topicEmbeddingContract: TOPIC_EMBEDDING_CONTRACT,
  }
  const report: ImportReport = {
    runId: randomUUID(),
    startedAt: new Date().toISOString(),
    sourceVersions,
    sourceSha256: {
      openbibleScores: await sha256File(OPENBIBLE_SCORES),
      openbibleVotes: await sha256File(OPENBIBLE_VOTES),
    },
    topicsImported: 0,
    aliasesImported: 0,
    passagesImported: { nave: 0, torrey: 0, openbible: 0 },
    relationsImported: 0,
    duplicates: 0,
    referencesRejected: 0,
    unknownBooks: {},
    canonConflicts: 0,
    databaseBytesBefore: 0,
  }
  const topics = new Map<string, Topic>()
  const passages = new Map<string, Passage>()
  const pendingRelations: { from: string; to: string; source: SourceCode }[] = []

  await importNeuuSource({ source: 'nave', topics, passages, pendingRelations, report })
  await importNeuuSource({ source: 'torrey', topics, passages, pendingRelations, report })
  await importOpenBible(topics, passages, report)

  CONTROLLED_FRENCH_TOPIC_ALIASES.forEach(controlled => {
    const topic = topics.get(topicIdFor(controlled.topic))
    if (!topic) return
    addAlias(topic, {
      language: 'fr',
      alias: controlled.preferredLabel,
      method: 'editorial-controlled',
      validationStatus: 'validated',
      isPreferred: true,
    })
    controlled.aliases.forEach(alias =>
      addAlias(topic, {
        language: 'fr',
        alias,
        method: 'editorial-controlled',
        validationStatus: 'validated',
        isPreferred: false,
      })
    )
  })

  const relationsByKey = new Map<string, Relation>()
  pendingRelations.forEach(({ from, to, source }) => {
    if (!topics.has(from) || !topics.has(to)) return
    const key = `${from}:${to}:see-also:${source}`
    if (relationsByKey.has(key)) report.duplicates += 1
    relationsByKey.set(key, {
      topicId: from,
      relatedTopicId: to,
      relationType: 'see-also',
      source,
    })
  })
  const relations = [...relationsByKey.values()]
  report.topicsImported = topics.size
  report.aliasesImported = [...topics.values()].reduce((sum, topic) => sum + topic.aliases.size, 0)
  passages.forEach(passage => {
    report.passagesImported[passage.source] += 1
    if (passage.book > 66) report.canonConflicts += 1
  })
  report.relationsImported = relations.length

  await persistThematicSearchImport({
    topics,
    passages,
    relations,
    report,
    embeddingProvider,
  })
  report.durationMs = Math.round(performance.now() - started)
  await mkdir(dirname(REPORT_PATH), { recursive: true })
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
