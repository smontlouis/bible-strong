import i18n from '~i18n'
import { getBook } from '~helpers/bibleBookCatalog'
import verseToReference from '~helpers/verseToReference'
import type { HighlightsObj, LinksObj, NotesObj, StudiesObj } from '~redux/modules/user'
import type { WordAnnotation, WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import type { VersionCode } from '~state/tabs'
import {
  getRelationDisplayModel,
  normalizeRelation,
  type LegacyRelation,
  type Relation,
  type RelationEndpoint,
  type RelationsObj,
  type VerseRelationEndpoint,
} from '~features/studyRelations/domain'

export type PassageExportScope = 'selection' | 'chapter' | 'book'

export type PassageExportOptions = {
  bibleText: boolean
  notes: boolean
  links: boolean
  relations: boolean
  tags: boolean
}

export type PassageExportData = {
  notes: NotesObj
  links: LinksObj
  relations: RelationsObj
  wordAnnotations: WordAnnotationsObj
  studies: StudiesObj
  highlights?: HighlightsObj
  strongsGrec?: Record<string, unknown>
  strongsHebreu?: Record<string, unknown>
  naves?: Record<string, unknown>
  words?: Record<string, unknown>
}

export type PassageExportCounts = {
  notes: number
  links: number
  relations: number
  tags: number
}

export type PassageExportResult = {
  text: string
  reference: string
  verseKeys: string[]
  counts: PassageExportCounts
  missingVerseTextKeys: string[]
  hasSkippedInvalidData: boolean
}

type CreatePassageExportInput = {
  scope: PassageExportScope
  selectedVerseKeys: string[]
  scopeContext?: { book: number; chapter: number }
  version: { code: VersionCode; name: string }
  options: PassageExportOptions
  data: PassageExportData
  loadVerseTexts: (verseKeys: string[]) => Promise<Record<string, string>>
}

type ExportNote = {
  id: string
  verseKeys: string[]
  title: string
  description: string
  tags: ExportTag[]
  annotationTexts?: Record<string, string>
  extendsBeyondScope: boolean
}

type ExportLink = {
  id: string
  verseKeys: string[]
  title: string
  url: string
  tags: ExportTag[]
  extendsBeyondScope: boolean
}

type ExportRelation = {
  id: string
  verseKeys: string[]
  text: string
  extendsBeyondScope: boolean
}

type ExportTag = {
  id: string
  name: string
}

type ExportDiagnostics = {
  hasSkippedInvalidData: boolean
}

const RELATION_KINDS = new Set(['manual', 'system'])
const RELATION_TYPES = new Set([
  'linked',
  'references',
  'explains',
  'contrasts',
  'mentions',
  'annotates',
  'externalLink',
])
const RELATION_DIRECTIONS = new Set(['none', 'forward', 'backward'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const safeString = (value: unknown) => (typeof value === 'string' ? value : '')

const getTextLines = (value: unknown) =>
  safeString(value)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

const isValidVerseKey = (verseKey: string) => {
  const parts = verseKey.split('-').map(Number)
  return parts.length === 3 && parts.every(part => Number.isInteger(part) && part > 0)
}

const isValidRelationEndpoint = (endpoint: RelationEndpoint) => {
  switch (endpoint.type) {
    case 'verse':
      return endpoint.verseKeys.length > 0 && endpoint.verseKeys.every(isValidVerseKey)
    case 'note':
      return Boolean(endpoint.noteId)
    case 'study':
      return Boolean(endpoint.studyId)
    case 'strong':
      return (
        (endpoint.language === 'greek' || endpoint.language === 'hebrew') &&
        /^\d+$/.test(endpoint.code)
      )
    case 'nave':
      return Boolean(endpoint.nameLower)
    case 'dictionary':
    case 'word':
      return Boolean(endpoint.word)
    case 'externalLink':
      return Boolean(endpoint.linkId)
    case 'annotation':
      return Boolean(endpoint.annotationId)
    default:
      return false
  }
}

const getValidRelations = (relations: RelationsObj, diagnostics: ExportDiagnostics) =>
  Object.values(relations || {}).flatMap(value => {
    if (!isRecord(value)) {
      diagnostics.hasSkippedInvalidData = true
      return []
    }

    try {
      const relation = normalizeRelation(value as LegacyRelation)
      if (
        !relation.id ||
        !RELATION_KINDS.has(relation.kind) ||
        !RELATION_TYPES.has(relation.type) ||
        !RELATION_DIRECTIONS.has(relation.direction) ||
        !Array.isArray(relation.endpoints) ||
        relation.endpoints.length !== 2 ||
        !relation.endpoints.every(isValidRelationEndpoint)
      ) {
        throw new Error('Invalid relation')
      }
      return [relation]
    } catch {
      diagnostics.hasSkippedInvalidData = true
      return []
    }
  })

const getValidAnnotations = (
  wordAnnotations: WordAnnotationsObj,
  version: VersionCode,
  diagnostics: ExportDiagnostics
) =>
  Object.values(wordAnnotations || {}).flatMap(value => {
    if (!isRecord(value) || value.version !== version || !Array.isArray(value.ranges)) {
      if (isRecord(value) && value.version !== version) return []
      diagnostics.hasSkippedInvalidData = true
      return []
    }

    const ranges = value.ranges.flatMap(range => {
      if (!isRecord(range) || typeof range.verseKey !== 'string') {
        diagnostics.hasSkippedInvalidData = true
        return []
      }
      return [{ ...range, verseKey: range.verseKey, text: safeString(range.text) }]
    })
    if (!ranges.length) return []
    return [{ ...value, ranges } as unknown as WordAnnotation]
  })

const getRelationTargetMarker = (endpoint: RelationEndpoint) => {
  if (endpoint.type !== 'strong') return endpoint.type
  const prefix = endpoint.language === 'hebrew' ? 'H' : 'G'
  return `strong: ${prefix}${endpoint.code}`
}

const orderVerseKeys = (verseKeys: string[]) =>
  Array.from(new Set(verseKeys)).sort((left, right) => {
    const [leftBook, leftChapter, leftVerse] = left.split('-').map(Number)
    const [rightBook, rightChapter, rightVerse] = right.split('-').map(Number)
    return leftBook - rightBook || leftChapter - rightChapter || leftVerse - rightVerse
  })

const getTags = (tags: unknown, diagnostics: ExportDiagnostics): ExportTag[] => {
  if (tags === undefined) return []
  if (!isRecord(tags)) {
    diagnostics.hasSkippedInvalidData = true
    return []
  }

  return Object.entries(tags)
    .flatMap(([key, value]) => {
      if (!isRecord(value)) {
        diagnostics.hasSkippedInvalidData = true
        return []
      }
      const name = safeString(value.name).trim()
      if (!name) {
        diagnostics.hasSkippedInvalidData = true
        return []
      }
      return [{ id: safeString(value.id) || key, name }]
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
}

const getVerseEndpoint = (relation: Relation): VerseRelationEndpoint | undefined =>
  relation.endpoints.find(
    (endpoint): endpoint is VerseRelationEndpoint => endpoint.type === 'verse'
  )

const getScopeContext = (
  selectedVerseKeys: string[],
  scopeContext?: { book: number; chapter: number }
) => {
  if (scopeContext) return scopeContext
  const [book, chapter] = selectedVerseKeys[0]?.split('-').map(Number) || []
  return { book, chapter }
}

const getScopeReference = (
  scope: PassageExportScope,
  selectedVerseKeys: string[],
  scopeContext?: { book: number; chapter: number }
) => {
  const { book, chapter } = getScopeContext(selectedVerseKeys, scopeContext)
  if (scope === 'selection') return verseToReference(selectedVerseKeys)
  if (scope === 'chapter') return verseToReference({ bookNum: book, chapterNum: chapter })

  const bookName = getBook(book)?.Nom
  return bookName ? i18n.t(bookName) : i18n.t('Livre {{bookNumber}}', { bookNumber: book })
}

const createScopeMatcher = (
  scope: PassageExportScope,
  selectedVerseKeys: string[],
  scopeContext?: { book: number; chapter: number }
) => {
  const selectedKeys = new Set(selectedVerseKeys)
  const { book, chapter } = getScopeContext(selectedVerseKeys, scopeContext)

  return (verseKey: string) => {
    if (scope === 'selection') return selectedKeys.has(verseKey)
    const [verseBook, verseChapter] = verseKey.split('-').map(Number)
    if (scope === 'chapter') return verseBook === book && verseChapter === chapter
    return verseBook === book
  }
}

const getScopedVerseKeys = (verseKeys: string[], isInScope: (verseKey: string) => boolean) =>
  orderVerseKeys(verseKeys.filter(isInScope))

const getNoteExports = (
  data: PassageExportData,
  relations: Relation[],
  annotations: WordAnnotation[],
  isInScope: (verseKey: string) => boolean,
  diagnostics: ExportDiagnostics
): ExportNote[] => {
  const exportsById = new Map<string, ExportNote>()

  relations.forEach(relation => {
    if (relation.deletedAt || relation.kind !== 'system' || relation.type !== 'annotates') return
    const noteEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'note')
    const verseEndpoint = getVerseEndpoint(relation)
    if (noteEndpoint?.type !== 'note' || !verseEndpoint) return

    const scopedVerseKeys = getScopedVerseKeys(verseEndpoint.verseKeys, isInScope)
    if (!scopedVerseKeys.length || noteEndpoint.noteId.startsWith('annotation:')) return
    const note = data.notes?.[noteEndpoint.noteId]
    if (!isRecord(note)) {
      diagnostics.hasSkippedInvalidData = true
      return
    }

    const existing = exportsById.get(noteEndpoint.noteId)
    if (existing) {
      existing.verseKeys = orderVerseKeys([...existing.verseKeys, ...verseEndpoint.verseKeys])
      existing.extendsBeyondScope ||= verseEndpoint.verseKeys.some(key => !isInScope(key))
      return
    }

    exportsById.set(noteEndpoint.noteId, {
      id: noteEndpoint.noteId,
      verseKeys: verseEndpoint.verseKeys,
      title: safeString(note.title),
      description: safeString(note.description),
      tags: getTags(note.tags, diagnostics),
      extendsBeyondScope: verseEndpoint.verseKeys.some(key => !isInScope(key)),
    })
  })

  annotations.forEach(annotation => {
    if (!annotation.noteId) return
    const scopedRanges = annotation.ranges.filter(range => isInScope(range.verseKey))
    if (!scopedRanges.length || exportsById.has(annotation.noteId)) return
    const note = data.notes?.[annotation.noteId]
    if (!isRecord(note)) {
      diagnostics.hasSkippedInvalidData = true
      return
    }

    exportsById.set(annotation.noteId, {
      id: annotation.noteId,
      verseKeys: orderVerseKeys(annotation.ranges.map(range => range.verseKey)),
      title: safeString(note.title),
      description: safeString(note.description),
      tags: getTags(note.tags, diagnostics),
      annotationTexts: scopedRanges.reduce<Record<string, string>>((texts, range) => {
        texts[range.verseKey] = [texts[range.verseKey], range.text].filter(Boolean).join(' ')
        return texts
      }, {}),
      extendsBeyondScope: annotation.ranges.some(range => !isInScope(range.verseKey)),
    })
  })

  return Array.from(exportsById.values())
}

const getLinkExports = (
  data: PassageExportData,
  relations: Relation[],
  isInScope: (verseKey: string) => boolean,
  diagnostics: ExportDiagnostics
): ExportLink[] => {
  const exportsById = new Map<string, ExportLink>()

  relations.forEach(relation => {
    if (relation.deletedAt || relation.kind !== 'system' || relation.type !== 'externalLink') return
    const linkEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'externalLink')
    const verseEndpoint = getVerseEndpoint(relation)
    if (linkEndpoint?.type !== 'externalLink' || !verseEndpoint) return
    if (!verseEndpoint.verseKeys.some(isInScope)) return
    const link = data.links?.[linkEndpoint.linkId]
    if (!isRecord(link)) {
      diagnostics.hasSkippedInvalidData = true
      return
    }

    const existing = exportsById.get(linkEndpoint.linkId)
    if (existing) {
      existing.verseKeys = orderVerseKeys([...existing.verseKeys, ...verseEndpoint.verseKeys])
      existing.extendsBeyondScope ||= verseEndpoint.verseKeys.some(key => !isInScope(key))
      return
    }

    exportsById.set(linkEndpoint.linkId, {
      id: linkEndpoint.linkId,
      verseKeys: verseEndpoint.verseKeys,
      title:
        safeString(link.customTitle) ||
        (isRecord(link.ogData) ? safeString(link.ogData.title) : '') ||
        safeString(link.url),
      url: safeString(link.url),
      tags: getTags(link.tags, diagnostics),
      extendsBeyondScope: verseEndpoint.verseKeys.some(key => !isInScope(key)),
    })
  })

  return Array.from(exportsById.values())
}

const getRelationExports = (
  data: PassageExportData,
  relations: Relation[],
  annotations: WordAnnotation[],
  isInScope: (verseKey: string) => boolean,
  diagnostics: ExportDiagnostics
): ExportRelation[] => {
  const annotationVerseKeysById = Object.fromEntries(
    annotations.map(annotation => [annotation.id, annotation.ranges.map(range => range.verseKey)])
  )

  return relations.flatMap(relation => {
    if (relation.deletedAt || relation.kind !== 'manual') return []
    const getActiveEndpointVerseKeys = (endpoint: RelationEndpoint) => {
      if (endpoint.type === 'verse') return endpoint.verseKeys
      if (endpoint.type === 'annotation') {
        return annotationVerseKeysById[endpoint.annotationId] || []
      }
      return []
    }
    const activeEndpoints = relation.endpoints.flatMap(endpoint => {
      const verseKeys = getActiveEndpointVerseKeys(endpoint)
      return verseKeys.some(isInScope) ? [{ endpoint, verseKeys }] : []
    })

    return activeEndpoints.flatMap(({ endpoint: activeEndpoint, verseKeys }) => {
      let displayModel
      try {
        displayModel = getRelationDisplayModel(relation, activeEndpoint, data)
      } catch {
        diagnostics.hasSkippedInvalidData = true
        return []
      }
      if (!displayModel) return []
      const relationLabel = relation.label
        ? `${displayModel.relationText} (${relation.label})`
        : displayModel.relationText
      const targetMarker = getRelationTargetMarker(displayModel.targetEndpoint)

      return [
        {
          id: relation.id,
          verseKeys,
          text: `${relationLabel} → [${targetMarker}] ${displayModel.targetLabel}`,
          extendsBeyondScope: verseKeys.some(key => !isInScope(key)),
        },
      ]
    })
  })
}

const getTagsByVerse = (
  data: PassageExportData,
  annotations: WordAnnotation[],
  notes: ExportNote[],
  links: ExportLink[],
  isInScope: (verseKey: string) => boolean,
  diagnostics: ExportDiagnostics
) => {
  const tagsByVerse = new Map<string, Map<string, ExportTag>>()
  const addTags = (verseKey: string, tags: ExportTag[]) => {
    if (!isInScope(verseKey) || !tags.length) return
    const verseTags = tagsByVerse.get(verseKey) || new Map<string, ExportTag>()
    tags.forEach(tag => verseTags.set(tag.id, tag))
    tagsByVerse.set(verseKey, verseTags)
  }

  Object.entries(data.highlights || {}).forEach(([verseKey, highlight]) => {
    if (!isRecord(highlight)) {
      diagnostics.hasSkippedInvalidData = true
      return
    }
    addTags(verseKey, getTags(highlight.tags, diagnostics))
  })
  annotations.forEach(annotation => {
    const tags = getTags(annotation.tags, diagnostics)
    annotation.ranges.forEach(range => addTags(range.verseKey, tags))
  })
  notes.forEach(note => {
    note.verseKeys.forEach(verseKey => addTags(verseKey, note.tags))
  })
  links.forEach(link => {
    link.verseKeys.forEach(verseKey => addTags(verseKey, link.tags))
  })

  return Object.fromEntries(
    Array.from(tagsByVerse.entries()).map(([verseKey, tags]) => [
      verseKey,
      Array.from(tags.values()).sort(
        (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
      ),
    ])
  )
}

type TextListItem = {
  firstLine: string
  detailLines: string[]
}

const getScopeOverflowLine = (extendsBeyondScope: boolean) =>
  extendsBeyondScope ? i18n.t('passageExport.extendsBeyondScope') : undefined

const formatNote = (note: ExportNote, verseKey: string) => {
  const annotationText = note.annotationTexts?.[verseKey]
  const [title = '', ...titleDetails] = getTextLines(note.title)
  const annotationLines = getTextLines(annotationText)
  const annotation = annotationLines.length
    ? `${title ? ' — ' : ''}« ${annotationLines.join(' ')} »`
    : ''
  const contentLines = [
    `${title}${annotation}`,
    ...titleDetails,
    ...getTextLines(note.description),
  ].filter(Boolean)
  const [firstLine = '', ...detailLines] = contentLines

  return {
    firstLine,
    detailLines: [...detailLines, getScopeOverflowLine(note.extendsBeyondScope)].filter(
      (line): line is string => Boolean(line)
    ),
  }
}

const formatLink = (link: ExportLink): TextListItem => {
  const titleLines = getTextLines(link.title)
  const urlLines = getTextLines(link.url)
  const [firstLine = '', ...detailTitleLines] = titleLines.length ? titleLines : urlLines
  return {
    firstLine,
    detailLines: [
      ...detailTitleLines,
      ...(titleLines.length ? urlLines : []),
      getScopeOverflowLine(link.extendsBeyondScope),
    ].filter((line): line is string => Boolean(line)),
  }
}

const VERSE_SEPARATOR = '-'.repeat(40)
const HEADER_SEPARATOR = '='.repeat(40)
const SECTION_SEPARATOR = '-'.repeat(10)

const formatListItem = (item: TextListItem) =>
  [`• ${item.firstLine}`, ...item.detailLines.map(line => (line ? `  ${line}` : ''))].join('\n')

const addSection = (sections: string[], title: string, items: TextListItem[]) => {
  if (items.length) {
    sections.push(`${title}\n${SECTION_SEPARATOR}\n${items.map(formatListItem).join('\n\n')}`)
  }
}

const groupByVerse = <T extends { verseKeys: string[] }>(items: T[]) => {
  const groups = new Map<string, T[]>()
  items.forEach(item => {
    item.verseKeys.forEach(verseKey => {
      const group = groups.get(verseKey) || []
      group.push(item)
      groups.set(verseKey, group)
    })
  })
  return groups
}

const formatVerseGroup = ({
  verseKey,
  verseText,
  notes,
  links,
  relations,
  tags,
}: {
  verseKey: string
  verseText?: string
  notes: ExportNote[]
  links: ExportLink[]
  relations: ExportRelation[]
  tags: ExportTag[]
}) => {
  const sections = [`${VERSE_SEPARATOR}\n${verseToReference(verseKey)}\n${VERSE_SEPARATOR}`]
  if (verseText) sections.push(verseText)
  addSection(
    sections,
    i18n.t('passageExport.section.notes'),
    notes.map(note => formatNote(note, verseKey))
  )
  addSection(sections, i18n.t('passageExport.section.links'), links.map(formatLink))
  addSection(
    sections,
    i18n.t('passageExport.section.relations'),
    relations.map(relation => {
      const [firstLine = '', ...detailLines] = getTextLines(relation.text)
      return {
        firstLine,
        detailLines: [...detailLines, getScopeOverflowLine(relation.extendsBeyondScope)].filter(
          (line): line is string => Boolean(line)
        ),
      }
    })
  )
  addSection(
    sections,
    i18n.t('passageExport.section.tags'),
    tags.map(tag => {
      const [firstLine = '', ...detailLines] = getTextLines(tag.name)
      return { firstLine, detailLines }
    })
  )
  return sections.join('\n\n')
}

export const createPassageExport = async ({
  scope,
  selectedVerseKeys,
  scopeContext,
  version,
  options,
  data,
  loadVerseTexts,
}: CreatePassageExportInput): Promise<PassageExportResult> => {
  const diagnostics: ExportDiagnostics = { hasSkippedInvalidData: false }
  const orderedSelection = orderVerseKeys(selectedVerseKeys)
  const reference = getScopeReference(scope, orderedSelection, scopeContext)
  const isInScope = createScopeMatcher(scope, orderedSelection, scopeContext)
  const validRelations = getValidRelations(data.relations, diagnostics)
  const annotations = getValidAnnotations(data.wordAnnotations, version.code, diagnostics)
  const attachedNotes =
    options.notes || options.tags || options.bibleText
      ? getNoteExports(data, validRelations, annotations, isInScope, diagnostics)
      : []
  const attachedLinks =
    options.links || options.tags || options.bibleText
      ? getLinkExports(data, validRelations, isInScope, diagnostics)
      : []
  const notes = options.notes ? attachedNotes : []
  const links = options.links ? attachedLinks : []
  const attachedRelations =
    options.relations || options.bibleText
      ? getRelationExports(data, validRelations, annotations, isInScope, diagnostics)
      : []
  const relations = options.relations ? attachedRelations : []
  const attachedTagsByVerse =
    options.tags || options.bibleText
      ? getTagsByVerse(data, annotations, attachedNotes, attachedLinks, isInScope, diagnostics)
      : {}
  const tagsByVerse = options.tags ? attachedTagsByVerse : {}

  const enrichedVerseKeys = orderVerseKeys([
    ...(options.bibleText ? attachedNotes : notes).flatMap(note =>
      note.verseKeys.filter(isInScope)
    ),
    ...(options.bibleText ? attachedLinks : links).flatMap(link =>
      link.verseKeys.filter(isInScope)
    ),
    ...(options.bibleText ? attachedRelations : relations).flatMap(relation =>
      relation.verseKeys.filter(isInScope)
    ),
    ...Object.keys(options.bibleText ? attachedTagsByVerse : tagsByVerse),
  ])
  const verseKeys = enrichedVerseKeys
  const verseTexts = await loadVerseTexts(options.bibleText ? verseKeys : [])
  const missingVerseTextKeys = options.bibleText
    ? verseKeys.filter(verseKey => !safeString(verseTexts?.[verseKey]).trim())
    : []
  const notesByVerse = groupByVerse(notes)
  const linksByVerse = groupByVerse(links)
  const relationsByVerse = groupByVerse(relations)
  const sections = [`${reference} — ${version.name} (${version.code})\n${HEADER_SEPARATOR}`]

  sections.push(
    ...verseKeys.map(verseKey =>
      formatVerseGroup({
        verseKey,
        verseText: options.bibleText
          ? safeString(verseTexts?.[verseKey]).trim() ||
            i18n.t('passageExport.verseTextUnavailable')
          : undefined,
        notes: notesByVerse.get(verseKey) || [],
        links: linksByVerse.get(verseKey) || [],
        relations: relationsByVerse.get(verseKey) || [],
        tags: tagsByVerse[verseKey] || [],
      })
    )
  )

  return {
    text: sections.join('\n\n'),
    reference,
    verseKeys,
    counts: {
      notes: notes.length,
      links: links.length,
      relations: new Set(relations.map(relation => relation.id)).size,
      tags: new Set(Object.values(tagsByVerse).flatMap(tags => tags.map(tag => tag.id))).size,
    },
    missingVerseTextKeys,
    hasSkippedInvalidData: diagnostics.hasSkippedInvalidData,
  }
}
