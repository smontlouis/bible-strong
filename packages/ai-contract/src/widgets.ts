import { parseStudySource, type StudySource } from './sources'
/** Presentation descriptors contain references, never model-authored Bible text. */
export type PassageTarget = {
  book: number
  chapter: number
  start: number
  end: number
  version: string
}
export type PassageWidget = {
  id: string
  kind: 'passages' | 'passage_comparison' | 'translation_comparison' | 'verse_analysis'
  title: string
  passages: PassageTarget[]
  analysis?: string
}
export type LexicalWidget = {
  id: string
  kind: 'strong_entry' | 'concordance'
  version?: string
  title: string
  reference: string
  identityKind: 'strong' | 'dstrong' | 'estrong' | 'ustrong'
  language: 'fr' | 'en'
  scope: 'precise_identity' | 'classic_family'
}
export type SourceGroupWidget = {
  id: string
  kind: 'commentary_comparison' | 'dictionary_articles'
  title: string
  sources: StudySource[]
}
export type NaveWidget = {
  id: string
  kind: 'nave_topic'
  title: string
  topic: string
  language: 'fr' | 'en'
}
export type EntityWidget = {
  id: string
  kind: 'person_profile' | 'place_profile' | 'entity_profile' | 'entity_relations'
  title: string
  entityKey: string
  language: 'fr' | 'en'
}
export type TimelineWidget = {
  id: string
  kind: 'event_timeline'
  title: string
  events: string[]
  language: 'fr' | 'en'
}
export type BookWidget = {
  id: string
  kind: 'book_overview'
  title: string
  book: number
  version: string
  language: 'fr' | 'en'
}
export type ReadingWidget = {
  id: string
  kind: 'reading_plan' | 'meditation'
  title: string
  planId: string
  readingId: string
  language: 'fr' | 'en'
  reflection?: string
}
export type ResourceSuggestion = {
  kind: 'media' | 'reading' | 'dictionary' | 'commentary' | 'nave'
  label: string
  id: string
  language: 'fr' | 'en'
  work?: string
  word?: string
  book?: number
  chapter?: number
}
export type FurtherResourcesWidget = {
  id: string
  kind: 'further_resources'
  title: string
  items: ResourceSuggestion[]
  unavailable?: string[]
}
export type StudyWidget =
  | BookWidget
  | ReadingWidget
  | FurtherResourcesWidget
  | PassageWidget
  | LexicalWidget
  | SourceGroupWidget
  | NaveWidget
  | EntityWidget
  | TimelineWidget
export function parsePassageTarget(value: unknown): PassageTarget {
  if (!value || typeof value !== 'object') throw new Error('INVALID_WIDGET_PASSAGE')
  const p = value as PassageTarget
  if (
    !Number.isInteger(p.book) ||
    p.book < 1 ||
    p.book > 66 ||
    !Number.isInteger(p.chapter) ||
    p.chapter < 1 ||
    p.chapter > 150 ||
    !Number.isInteger(p.start) ||
    p.start < 1 ||
    !Number.isInteger(p.end) ||
    p.end < p.start ||
    p.end > 176 ||
    p.end - p.start > 19 ||
    typeof p.version !== 'string' ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(p.version)
  )
    throw new Error('INVALID_WIDGET_PASSAGE')
  return { book: p.book, chapter: p.chapter, start: p.start, end: p.end, version: p.version }
}
function parsePassageWidget(value: unknown): PassageWidget {
  if (!value || typeof value !== 'object') throw new Error('INVALID_WIDGET')
  const w = value as PassageWidget
  if (
    typeof w.id !== 'string' ||
    !/^w[1-6]$/.test(w.id) ||
    !['passages', 'passage_comparison', 'translation_comparison', 'verse_analysis'].includes(
      w.kind
    ) ||
    typeof w.title !== 'string' ||
    !w.title.trim() ||
    w.title.length > 120 ||
    !Array.isArray(w.passages) ||
    w.passages.length < 1 ||
    w.passages.length > 12 ||
    (w.analysis !== undefined && (typeof w.analysis !== 'string' || w.analysis.length > 1600))
  )
    throw new Error('INVALID_WIDGET')
  const passages = w.passages.map(parsePassageTarget)
  if (
    (w.kind === 'passage_comparison' || w.kind === 'translation_comparison') &&
    (passages.length < 2 || passages.length > 4)
  )
    throw new Error('INVALID_WIDGET_COMPARISON')
  if (
    w.kind === 'verse_analysis' &&
    (passages.length !== 1 || passages[0].end - passages[0].start > 7)
  )
    throw new Error('INVALID_WIDGET_VERSE_ANALYSIS')
  if (w.kind === 'translation_comparison') {
    const first = passages[0]
    if (
      passages.some(
        p =>
          p.book !== first.book ||
          p.chapter !== first.chapter ||
          p.start !== first.start ||
          p.end !== first.end
      ) ||
      new Set(passages.map(p => p.version)).size !== passages.length
    )
      throw new Error('INVALID_WIDGET_TRANSLATIONS')
  }
  return {
    id: w.id,
    kind: w.kind,
    title: w.title,
    passages,
    ...(w.analysis ? { analysis: w.analysis } : {}),
  }
}

export function parseStudyWidget(value: unknown): StudyWidget {
  if (!value || typeof value !== 'object') throw new Error('INVALID_WIDGET')
  const common = value as StudyWidget
  if (
    typeof common.id !== 'string' ||
    !/^w[1-6]$/.test(common.id) ||
    typeof common.title !== 'string' ||
    !common.title.trim() ||
    common.title.length > 120
  )
    throw new Error('INVALID_WIDGET')
  if (common.kind === 'book_overview') {
    parsePassageTarget({ book: common.book, chapter: 1, start: 1, end: 1, version: common.version })
    if (!['fr', 'en'].includes(common.language)) throw new Error('INVALID_BOOK_WIDGET')
    return {
      id: common.id,
      kind: common.kind,
      title: common.title,
      book: common.book,
      version: common.version,
      language: common.language,
    }
  }
  if (common.kind === 'reading_plan' || common.kind === 'meditation') {
    if (
      !validEditorialId(common.planId) ||
      !validEditorialId(common.readingId) ||
      !['fr', 'en'].includes(common.language) ||
      (common.reflection !== undefined &&
        (typeof common.reflection !== 'string' || common.reflection.length > 1200))
    )
      throw new Error('INVALID_READING_WIDGET')
    return {
      id: common.id,
      kind: common.kind,
      title: common.title,
      planId: common.planId,
      readingId: common.readingId,
      language: common.language,
      ...(common.reflection ? { reflection: common.reflection } : {}),
    }
  }
  if (common.kind === 'further_resources') {
    if (!Array.isArray(common.items) || common.items.length > 12)
      throw new Error('INVALID_RESOURCE_WIDGET')
    if (
      common.unavailable !== undefined &&
      (!Array.isArray(common.unavailable) ||
        common.unavailable.length > 5 ||
        common.unavailable.some(
          value => !['dictionary', 'nave', 'reading', 'commentary', 'media'].includes(value)
        ))
    )
      throw new Error('INVALID_RESOURCE_WIDGET')
    return {
      id: common.id,
      kind: common.kind,
      title: common.title,
      items: common.items.map(parseResourceSuggestion),
      ...(common.unavailable ? { unavailable: common.unavailable } : {}),
    }
  }
  if ('entityKey' in common) {
    if (
      !['person_profile', 'place_profile', 'entity_profile', 'entity_relations'].includes(
        common.kind
      ) ||
      typeof common.entityKey !== 'string' ||
      !common.entityKey.trim() ||
      common.entityKey.length > 200 ||
      /[\\/\u0000-\u001f]/u.test(common.entityKey) ||
      !['fr', 'en'].includes(common.language)
    )
      throw new Error('INVALID_ENTITY_WIDGET')
    return {
      id: common.id,
      kind: common.kind,
      title: common.title,
      entityKey: common.entityKey,
      language: common.language,
    }
  }
  if (common.kind === 'event_timeline') {
    if (
      !Array.isArray(common.events) ||
      !common.events.length ||
      common.events.length > 8 ||
      common.events.some(
        id =>
          typeof id !== 'string' || !id.trim() || id.length > 200 || /[\\/\u0000-\u001f]/u.test(id)
      ) ||
      !['fr', 'en'].includes(common.language)
    )
      throw new Error('INVALID_TIMELINE_WIDGET')
    return {
      id: common.id,
      kind: common.kind,
      title: common.title,
      events: [...new Set(common.events)],
      language: common.language,
    }
  }
  if (common.kind === 'commentary_comparison' || common.kind === 'dictionary_articles') {
    if (!Array.isArray(common.sources) || !common.sources.length || common.sources.length > 6)
      throw new Error('INVALID_SOURCE_WIDGET')
    const sources = common.sources.map(parseStudySource)
    if (
      sources.some(
        source =>
          source.kind !== (common.kind === 'commentary_comparison' ? 'commentary' : 'dictionary')
      )
    )
      throw new Error('INVALID_SOURCE_WIDGET')
    return { id: common.id, kind: common.kind, title: common.title, sources }
  }
  if (common.kind === 'nave_topic') {
    if (
      typeof common.topic !== 'string' ||
      !common.topic.trim() ||
      common.topic.length > 200 ||
      !['fr', 'en'].includes(common.language)
    )
      throw new Error('INVALID_NAVE_WIDGET')
    return {
      id: common.id,
      kind: common.kind,
      title: common.title,
      topic: common.topic,
      language: common.language,
    }
  }
  const w = value as LexicalWidget
  if (w.kind !== 'strong_entry' && w.kind !== 'concordance') return parsePassageWidget(value)
  if (
    !/^w[1-6]$/.test(w.id) ||
    typeof w.title !== 'string' ||
    !w.title.trim() ||
    w.title.length > 120 ||
    typeof w.reference !== 'string' ||
    !/^[GH]\d{1,5}[A-Z]{0,4}$/.test(w.reference) ||
    !['strong', 'dstrong', 'estrong', 'ustrong'].includes(w.identityKind) ||
    !['fr', 'en'].includes(w.language) ||
    (w.version !== undefined &&
      (typeof w.version !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(w.version))) ||
    !['precise_identity', 'classic_family'].includes(w.scope)
  )
    throw new Error('INVALID_LEXICAL_WIDGET')
  if (
    w.scope === 'classic_family' &&
    (!/^[GH]\d{1,5}$/.test(w.reference) || w.identityKind !== 'strong')
  )
    throw new Error('INVALID_LEXICAL_WIDGET')
  return {
    id: w.id,
    kind: w.kind,
    title: w.title,
    reference: w.reference,
    identityKind: w.identityKind,
    language: w.language,
    scope: w.scope,
    ...(w.version ? { version: w.version } : {}),
  }
}

export function widgetMemoryText(widget: StudyWidget): string {
  const targets =
    'passages' in widget
      ? widget.passages.map(p => `livre ${p.book}, ${p.chapter}:${p.start}-${p.end}, ${p.version}`)
      : 'sources' in widget
        ? widget.sources.map(source => source.title)
        : 'reference' in widget
          ? [`${widget.reference}, ${widget.scope}`]
          : 'topic' in widget
            ? [widget.topic]
            : 'entityKey' in widget
              ? [widget.entityKey]
              : 'events' in widget
                ? widget.events
                : 'planId' in widget
                  ? [widget.planId, widget.readingId]
                  : 'book' in widget
                    ? [`livre ${widget.book}, ${widget.version}`]
                    : widget.items.map(item => item.label)
  return `[Présentation ${widget.title} : ${targets.map((target, index) => `${index + 1}) ${target}`).join('; ')}]`
}

const validEditorialId = (id: unknown): id is string =>
  typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id)
function parseResourceSuggestion(value: unknown): ResourceSuggestion {
  if (!value || typeof value !== 'object') throw new Error('INVALID_RESOURCE_SUGGESTION')
  const r = value as ResourceSuggestion
  if (
    !['media', 'reading', 'dictionary', 'commentary', 'nave'].includes(r.kind) ||
    typeof r.label !== 'string' ||
    !r.label.trim() ||
    r.label.length > 300 ||
    typeof r.id !== 'string' ||
    !r.id.trim() ||
    r.id.length > 200 ||
    /[\\/\u0000-\u001f]/u.test(r.id) ||
    !['fr', 'en'].includes(r.language)
  )
    throw new Error('INVALID_RESOURCE_SUGGESTION')
  if ((r.kind === 'media' || r.kind === 'reading') && !validEditorialId(r.id))
    throw new Error('INVALID_RESOURCE_SUGGESTION')
  if (
    r.kind === 'dictionary' &&
    (!['bost', 'calmet', 'lelievre', 'westphal'].includes(r.work || '') ||
      !/^\d+$/.test(r.id) ||
      typeof r.word !== 'string' ||
      !r.word.trim() ||
      r.word.length > 200)
  )
    throw new Error('INVALID_RESOURCE_SUGGESTION')
  if (
    r.kind === 'commentary' &&
    (!['acbc', 'barnes', 'aquifer-fr'].includes(r.id) ||
      !Number.isInteger(r.book) ||
      !Number.isInteger(r.chapter) ||
      r.book! < 1 ||
      r.book! > 66 ||
      r.chapter! < 1 ||
      r.chapter! > 150)
  )
    throw new Error('INVALID_RESOURCE_SUGGESTION')
  return {
    kind: r.kind,
    label: r.label,
    id: r.id,
    language: r.language,
    ...(r.kind === 'dictionary' ? { work: r.work, word: r.word } : {}),
    ...(r.kind === 'commentary' ? { book: r.book, chapter: r.chapter } : {}),
  }
}
