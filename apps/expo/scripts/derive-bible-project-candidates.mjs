#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const DATA_DIR = 'docs/research/data/bible-project'
const CATALOG_PATH = `${DATA_DIR}/catalog.json`
const LOCALIZATION_PATH = `${DATA_DIR}/localization-candidates.json`
const ANCHOR_PATH = `${DATA_DIR}/anchor-candidates.json`
const AUDIT_PATH = `${DATA_DIR}/audit.json`

const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeReferenceText = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9:\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const TRANSLATIONS = new Map(
  Object.entries({
    agneau: 'lamb',
    aimer: 'love',
    amour: 'love',
    ange: 'angel',
    anges: 'angel',
    arbre: 'tree',
    benediction: 'blessing',
    bible: 'bible',
    caractere: 'character',
    ciel: 'heaven',
    cite: 'city',
    coeur: 'heart',
    commandement: 'commandment',
    commandements: 'commandment',
    compassion: 'compassion',
    conseil: 'council',
    creation: 'creation',
    demon: 'demon',
    demons: 'demon',
    dieu: 'god',
    eau: 'water',
    ecouter: 'listen',
    espoir: 'hope',
    esprit: 'spirit',
    eternel: 'eternal',
    eternelle: 'eternal',
    etre: 'being',
    etres: 'being',
    evangile: 'gospel',
    exil: 'exile',
    fidele: 'faithful',
    force: 'strength',
    generosite: 'generosity',
    gloire: 'glory',
    grace: 'grace',
    histoire: 'story',
    humanite: 'humanity',
    image: 'image',
    iniquite: 'iniquity',
    jesus: 'jesus',
    joie: 'joy',
    jour: 'day',
    justice: 'justice',
    lecture: 'reading',
    loi: 'law',
    malediction: 'curse',
    messie: 'messiah',
    montagne: 'mountain',
    nouveau: 'new',
    paix: 'peace',
    paraboles: 'parable',
    peche: 'sin',
    poesie: 'poetry',
    pretre: 'priest',
    pretres: 'priest',
    royaume: 'kingdom',
    sabbat: 'sabbath',
    sacerdoce: 'priesthood',
    sacrifice: 'atonement',
    sagesse: 'wisdom',
    saint: 'holy',
    saintete: 'holiness',
    salut: 'salvation',
    satan: 'satan',
    spirituel: 'spiritual',
    spirituels: 'spiritual',
    terre: 'earth',
    temple: 'temple',
    temoignage: 'witness',
    temoin: 'witness',
    transgression: 'transgression',
    vie: 'life',
  })
)

const STOP_WORDS = new Set([
  'a',
  'about',
  'and',
  'au',
  'aux',
  'avec',
  'book',
  'ce',
  'ces',
  'comment',
  'complete',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'et',
  'explained',
  'for',
  'from',
  'how',
  'in',
  'is',
  'la',
  'le',
  'les',
  'livre',
  'of',
  'on',
  'overview',
  'part',
  'partie',
  'pour',
  'projet',
  'project',
  'que',
  'qui',
  'series',
  'summary',
  'sur',
  'the',
  'this',
  'to',
  'un',
  'une',
  'video',
  'what',
  'why',
])

const BOOK_ALIASES = new Map([
  [1, ['genesis', 'genese']],
  [2, ['exodus', 'exode']],
  [3, ['leviticus', 'levitique']],
  [4, ['numbers', 'nombres']],
  [5, ['deuteronomy', 'deuteronome']],
  [6, ['joshua', 'josue']],
  [7, ['judges', 'juges']],
  [8, ['ruth']],
  [9, ['1 samuel']],
  [10, ['2 samuel']],
  [11, ['1 kings', '1 rois']],
  [12, ['2 kings', '2 rois']],
  [13, ['1 chronicles', '1 chroniques']],
  [14, ['2 chronicles', '2 chroniques']],
  [15, ['ezra', 'esdras']],
  [16, ['nehemiah', 'nehemie']],
  [17, ['esther']],
  [18, ['job']],
  [19, ['psalms', 'psalm', 'psaumes', 'psaume']],
  [20, ['proverbs', 'proverbes']],
  [21, ['ecclesiastes', 'ecclesiaste']],
  [22, ['song of songs', 'song of solomon', 'cantique des cantiques']],
  [23, ['isaiah', 'esaie']],
  [24, ['jeremiah', 'jeremie']],
  [25, ['lamentations']],
  [26, ['ezekiel', 'ezechiel']],
  [27, ['daniel']],
  [28, ['hosea', 'osee']],
  [29, ['joel']],
  [30, ['amos']],
  [31, ['obadiah', 'abdias']],
  [32, ['jonah', 'jonas']],
  [33, ['micah', 'michee']],
  [34, ['nahum']],
  [35, ['habakkuk', 'habacuc']],
  [36, ['zephaniah', 'sophonie']],
  [37, ['haggai', 'aggee']],
  [38, ['zechariah', 'zacharie']],
  [39, ['malachi', 'malachie']],
  [40, ['matthew', 'matthieu']],
  [41, ['mark', 'marc']],
  [42, ['luke', 'luc']],
  [43, ['john', 'jean']],
  [44, ['acts', 'actes']],
  [45, ['romans', 'romains']],
  [46, ['1 corinthians', '1 corinthiens']],
  [47, ['2 corinthians', '2 corinthiens']],
  [48, ['galatians', 'galates']],
  [49, ['ephesians', 'ephesiens']],
  [50, ['philippians', 'philippiens']],
  [51, ['colossians', 'colossiens']],
  [52, ['1 thessalonians', '1 thessaloniciens']],
  [53, ['2 thessalonians', '2 thessaloniciens']],
  [54, ['1 timothy', '1 timothee']],
  [55, ['2 timothy', '2 timothee']],
  [56, ['titus', 'tite']],
  [57, ['philemon']],
  [58, ['hebrews', 'hebreux']],
  [59, ['james', 'jacques']],
  [60, ['1 peter', '1 pierre']],
  [61, ['2 peter', '2 pierre']],
  [62, ['1 john', '1 jean']],
  [63, ['2 john', '2 jean']],
  [64, ['3 john', '3 jean']],
  [65, ['jude']],
  [66, ['revelation', 'apocalypse']],
])

const extractBooks = title => {
  const value = ` ${normalize(title)} `
  const books = new Set()
  const combined = [
    [/\b1\s*(?:2|and\s*2)\s*(?:kings|rois)\b/, [11, 12]],
    [/\b1\s*(?:2|and\s*2)\s*(?:chronicles|chroniques)\b/, [13, 14]],
    [/\b(?:ezra\s+nehemiah|esdras\s+nehemie)\b/, [15, 16]],
    [/\b1\s*3\s*(?:john|jean)\b/, [62, 63, 64]],
  ]
  for (const [pattern, values] of combined)
    if (pattern.test(value)) values.forEach(book => books.add(book))
  for (const [book, aliases] of BOOK_ALIASES) {
    for (const alias of aliases) {
      if (new RegExp(`(?:^|\\s)${alias.replace(/\s+/g, '\\s+')}(?:$|\\s)`).test(value.trim())) {
        books.add(book)
        break
      }
    }
  }
  if (books.has(62) && books.has(63) && books.has(64)) books.delete(43)
  return [...books].sort((a, b) => a - b)
}

const extractTitleReferences = title => {
  const value = normalizeReferenceText(title)
  const references = []
  for (const [book, aliases] of BOOK_ALIASES) {
    for (const alias of [...aliases].sort((a, b) => b.length - a.length)) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
      const pattern = new RegExp(
        `(?:^|\\b)${escaped}\\s+(?:(?:chapter|chapitre|ch)\\s*)?(\\d{1,3})(?:\\s*:\\s*(\\d{1,3})(?:\\s*(?:-|a|to)\\s*(\\d{1,3}))?)?(?:\\s*(?:-|a|to)\\s*(\\d{1,3})(?!\\s*:))?`,
        'g'
      )
      for (const match of value.matchAll(pattern)) {
        references.push({
          book,
          chapterStart: Number(match[1]),
          ...(match[2] ? { verseStart: Number(match[2]) } : {}),
          ...(match[3] ? { verseEnd: Number(match[3]) } : {}),
          ...(match[4] ? { chapterEnd: Number(match[4]) } : {}),
          source: 'title',
        })
      }
    }
  }
  return uniqueBy(references, reference => JSON.stringify(reference))
}

const titleTokens = title =>
  new Set(
    normalize(title)
      .split(' ')
      .map(token => TRANSLATIONS.get(token) || token)
      .filter(token => token.length > 1 && !STOP_WORDS.has(token))
  )

const jaccard = (left, right) => {
  const intersection = [...left].filter(value => right.has(value)).length
  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 0
}

const referenceKeys = video =>
  new Set(
    extractTitleReferences(video.title).map(reference =>
      [
        reference.book,
        reference.chapterStart,
        reference.verseStart || 0,
        reference.chapterEnd || 0,
        reference.verseEnd || 0,
      ].join(':')
    )
  )

const sharedCount = (left, right) => [...left].filter(value => right.has(value)).length

const seriesKeys = video =>
  new Set(
    video.playlists.map(playlist =>
      normalize(playlist.title)
        .replace(/panoramas? ancien testament|old testament/g, 'old-testament')
        .replace(/panoramas? nouveau testament|new testament/g, 'new-testament')
        .replace(/commentaire visuel|visual commentaries/g, 'visual-commentary')
        .replace(/themes bibliques|biblical themes/g, 'biblical-themes')
        .replace(/comment lire la bible|how to read the bible/g, 'how-to-read')
        .replace(/etude de mots|word studies/g, 'word-studies')
        .replace(/la torah|the torah/g, 'torah')
        .replace(/luc actes|luke acts/g, 'luke-acts')
        .replace(/sagesse|wisdom/g, 'wisdom')
        .replace(/etres spirituels|spiritual beings/g, 'spiritual-beings')
        .replace(/sacerdoce royal|royal priest/g, 'royal-priest')
        .replace(/les 10 commandements|the 10 commandments/g, 'ten-commandments')
    )
  )

const featureCache = new Map()
const getFeatures = video => {
  const cached = featureCache.get(video.id)
  if (cached) return cached
  const features = {
    series: seriesKeys(video),
    books: new Set(extractBooks(video.title)),
    references: referenceKeys(video),
    tokens: titleTokens(video.title),
  }
  featureCache.set(video.id, features)
  return features
}

const CONFIRMED_PAIR_OVERRIDES = new Map([
  ['YZWuWGDIRjw', 'JGI8nNVkZpA'],
  ['-AnYtcOxw4s', 'vXHDUs28rPM'],
  ['uqDDycCxItU', 'elhazm4fZeE'],
  ['tebmrRnqFMg', 'VsAmFJ6quZk'],
  ['kvcJ_tHPc8I', 'Q7PgVAN2MPo'],
  ['LV0-KIsZsBc', 'uAQ5KaEd98Q'],
  ['UwxUrEnl9Bk', 'Pyk64lwOLpw'],
  ['LBICDuRlPmo', 'WylKQKFI_4M'],
  ['5lTa7w35MyE', '4M9BsOvx6cs'],
])

const scorePair = (fr, en) => {
  if (CONFIRMED_PAIR_OVERRIDES.get(fr.id) === en.id)
    return { score: 1, confidence: 'confirmed', reasons: ['official-series-editorial-match'] }
  if (fr.localizedCounterpartIds.includes(en.id))
    return { score: 1, confidence: 'confirmed', reasons: ['existing-plan-counterpart'] }

  const reasons = []
  let score = 0
  if (fr.category === en.category) {
    score += 0.12
    reasons.push('same-category')
  }
  const frFeatures = getFeatures(fr)
  const enFeatures = getFeatures(en)
  const frSeries = frFeatures.series
  const enSeries = enFeatures.series
  if (sharedCount(frSeries, enSeries)) {
    score += 0.2
    reasons.push('corresponding-official-series')
  }
  const frBooks = frFeatures.books
  const enBooks = enFeatures.books
  if (frBooks.size && enBooks.size && sharedCount(frBooks, enBooks)) {
    score += 0.25
    reasons.push('same-bible-book')
  }
  const frReferences = frFeatures.references
  const enReferences = enFeatures.references
  if (frReferences.size && enReferences.size && sharedCount(frReferences, enReferences)) {
    score += 0.25
    reasons.push('same-scripture-reference')
  }
  const tokenScore = jaccard(frFeatures.tokens, enFeatures.tokens)
  if (tokenScore >= 0.2) {
    score += Math.min(0.3, tokenScore * 0.4)
    reasons.push(`title-token-similarity:${tokenScore.toFixed(2)}`)
  }
  const maxDuration = Math.max(fr.durationSeconds, en.durationSeconds)
  if (maxDuration) {
    const ratio = Math.min(fr.durationSeconds, en.durationSeconds) / maxDuration
    if (ratio >= 0.97) {
      score += 0.2
      reasons.push('duration-within-3-percent')
    } else if (ratio >= 0.9) {
      score += 0.1
      reasons.push('duration-within-10-percent')
    }
  }
  score = Math.min(0.99, Number(score.toFixed(3)))
  return {
    score,
    confidence: score >= 0.75 ? 'high' : score >= 0.55 ? 'medium' : 'low',
    reasons,
  }
}

const uniqueBy = (items, key) => {
  const seen = new Set()
  return items.filter(item => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const main = async () => {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'))
  const french = catalog.videos.filter(video => video.language === 'fr')
  const english = catalog.videos.filter(video => video.language === 'en')

  const localizationRecords = french.map(video => {
    const candidates = english
      .map(candidate => ({
        id: candidate.id,
        title: candidate.title,
        ...scorePair(video, candidate),
      }))
      .filter(candidate => candidate.score >= 0.25 || candidate.confidence === 'confirmed')
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 8)
    return {
      sourceId: video.id,
      sourceTitle: video.title,
      sourceCategory: video.category,
      candidates,
    }
  })
  const localization = {
    schemaVersion: 2,
    generatedAt: catalog.generatedAt,
    refreshDueAt: catalog.refreshDueAt,
    method:
      'Plan-backed pairs are confirmed. Other candidates are ranked from official series, category, book/reference, translated title tokens, and duration; they require editorial review.',
    records: localizationRecords,
  }
  await writeFile(LOCALIZATION_PATH, `${JSON.stringify(localization, null, 2)}\n`)

  const anchorRecords = catalog.videos.map(video => {
    const correctedReferences = [
      ...extractTitleReferences(video.title),
      ...video.referenceMentions.filter(reference => reference.source === 'description'),
    ]
    const explicit = correctedReferences.map(reference => ({
      kind: 'scripture-reference',
      book: reference.book,
      chapterStart: reference.chapterStart,
      ...(reference.verseStart ? { verseStart: reference.verseStart } : {}),
      ...(reference.chapterEnd ? { chapterEnd: reference.chapterEnd } : {}),
      ...(reference.verseEnd ? { verseEnd: reference.verseEnd } : {}),
      confidence: reference.source === 'title' ? 'high' : 'medium',
      provenance: `youtube-${reference.source}`,
    }))
    const titleBooks = extractBooks(video.title)
    const bookScopes =
      video.category === 'book-overview'
        ? titleBooks.map(book => ({
            kind: 'book-scope',
            book,
            confidence: 'medium',
            provenance: 'publisher-title-and-official-series',
          }))
        : []
    const readingContexts = video.planOccurrences.flatMap(occurrence =>
      occurrence.references.map(reference => ({
        kind: 'reading-context',
        book: reference.book,
        chapters: reference.chapters,
        confidence: 'context-only',
        provenance: `${occurrence.planId}:${occurrence.readingSliceId}`,
      }))
    )
    return {
      videoId: video.id,
      language: video.language,
      title: video.title,
      category: video.category,
      candidates: uniqueBy([...explicit, ...bookScopes, ...readingContexts], item =>
        JSON.stringify(item)
      ),
    }
  })
  const anchors = {
    schemaVersion: 2,
    generatedAt: catalog.generatedAt,
    refreshDueAt: catalog.refreshDueAt,
    warning:
      'Only high-confidence title references are close to publishable. Description references, book scopes, and especially plan reading contexts require editorial review.',
    records: anchorRecords,
  }
  await writeFile(ANCHOR_PATH, `${JSON.stringify(anchors, null, 2)}\n`)

  const audit = JSON.parse(await readFile(AUDIT_PATH, 'utf8'))
  const hasCandidate = (record, confidence) =>
    record.candidates.some(candidate => candidate.confidence === confidence)
  audit.localizationCandidates = {
    frenchRecords: localizationRecords.length,
    confirmed: localizationRecords.filter(record => hasCandidate(record, 'confirmed')).length,
    highUnconfirmed: localizationRecords.filter(
      record => !hasCandidate(record, 'confirmed') && hasCandidate(record, 'high')
    ).length,
    mediumOnly: localizationRecords.filter(
      record =>
        !hasCandidate(record, 'confirmed') &&
        !hasCandidate(record, 'high') &&
        hasCandidate(record, 'medium')
    ).length,
    lowOnlyOrNone: localizationRecords.filter(
      record =>
        !hasCandidate(record, 'confirmed') &&
        !hasCandidate(record, 'high') &&
        !hasCandidate(record, 'medium')
    ).length,
  }
  audit.anchorCandidates = {
    videosWithAnyCandidate: anchorRecords.filter(record => record.candidates.length).length,
    videosWithHighConfidenceReference: anchorRecords.filter(record =>
      record.candidates.some(
        candidate => candidate.kind === 'scripture-reference' && candidate.confidence === 'high'
      )
    ).length,
    videosWithBookScope: anchorRecords.filter(record =>
      record.candidates.some(candidate => candidate.kind === 'book-scope')
    ).length,
    videosWithPlanReadingContext: anchorRecords.filter(record =>
      record.candidates.some(candidate => candidate.kind === 'reading-context')
    ).length,
  }
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
