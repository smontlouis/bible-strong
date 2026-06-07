import books from '~assets/bible_versions/books-desc'
import type { Link, Note, Study } from '~redux/modules/user'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import verseToReference from '~helpers/verseToReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import i18n from '~i18n'

export type RelationKind = 'manual' | 'system'
export type RelationType =
  | 'linked'
  | 'references'
  | 'explains'
  | 'contrasts'
  | 'mentions'
  | 'annotates'
  | 'externalLink'
export type RelationDirection = 'none' | 'forward' | 'backward'
export type RelationEndpointType =
  | 'verse'
  | 'note'
  | 'study'
  | 'strong'
  | 'nave'
  | 'dictionary'
  | 'externalLink'
  | 'word'

export type RelationEndpointBase = {
  type: RelationEndpointType
  key?: string
  labelFallback?: string
  label?: string
}

export type VerseRelationEndpoint = RelationEndpointBase & {
  type: 'verse'
  verseKeys: string[]
  reference?: {
    start: { book: number; chapter: number; verse: number }
    end: { book: number; chapter: number; verse: number }
  }
}

export type NoteRelationEndpoint = RelationEndpointBase & {
  type: 'note'
  noteId: string
}

export type StudyRelationEndpoint = RelationEndpointBase & {
  type: 'study'
  studyId: string
}

export type StrongRelationEndpoint = RelationEndpointBase & {
  type: 'strong'
  language: 'greek' | 'hebrew'
  code: string
  originalWord?: string
}

export type NaveRelationEndpoint = RelationEndpointBase & {
  type: 'nave'
  resourceLanguage?: string
  nameLower: string
}

export type DictionaryRelationEndpoint = RelationEndpointBase & {
  type: 'dictionary'
  resourceLanguage?: string
  word: string
}

export type ExternalLinkRelationEndpoint = RelationEndpointBase & {
  type: 'externalLink'
  linkId: string
  sourceKey: string
  url: string
}

export type WordRelationEndpoint = RelationEndpointBase & {
  type: 'word'
  resourceLanguage?: string
  word: string
}

export type RelationEndpoint =
  | VerseRelationEndpoint
  | NoteRelationEndpoint
  | StudyRelationEndpoint
  | StrongRelationEndpoint
  | NaveRelationEndpoint
  | DictionaryRelationEndpoint
  | ExternalLinkRelationEndpoint
  | WordRelationEndpoint

export type Relation = {
  id: string
  kind: RelationKind
  type: RelationType
  direction: RelationDirection
  endpoints: [RelationEndpoint, RelationEndpoint]
  endpointKeys: [string, string]
  endpointTypes: [RelationEndpointType, RelationEndpointType]
  pairKey: string
  duplicateKey: string
  verseStartKeys?: string[]
  verseEndpointKeys?: string[]
  label?: string
  createdAt: number
  updatedAt: number
  createdBy?: string
  updatedBy?: string
  deletedAt?: number
}

export type RelationsObj = Record<string, Relation>
export type RelationIndexEntry = {
  entityKey: string
  totalCount: number
  countsByType?: Partial<Record<RelationType, number>>
  countsByEntityType?: Partial<Record<RelationEndpointType, number>>
  updatedAt: number
}
export type RelationIndexObj = Record<string, RelationIndexEntry>
export type RelationPair = {
  duplicateKey: string
  relationId: string
  createdAt: number
}
export type RelationPairsObj = Record<string, RelationPair>

export type StudyRelation = Relation
export type StudyRelationsObj = RelationsObj

export type RelationDisplayModel = {
  relation: Relation
  activeEndpoint: RelationEndpoint
  targetEndpoint: RelationEndpoint
  title: string
  subtitle: string
  relationText: string
  targetLabel: string
  isTargetAvailable: boolean
}

export type LegacyRelationEndpoint =
  | ({ type: 'verse'; verseKeys: string[]; label?: string } & Partial<VerseRelationEndpoint>)
  | ({ type: 'note'; noteId: string; label?: string } & Partial<NoteRelationEndpoint>)
  | ({ type: 'study'; studyId: string; label?: string } & Partial<StudyRelationEndpoint>)
  | ({
      type: 'strong'
      language: 'greek' | 'hebrew'
      code: string
      label?: string
      originalWord?: string
    } & Partial<StrongRelationEndpoint>)
  | ({ type: 'nave'; nameLower: string; label?: string } & Partial<NaveRelationEndpoint>)
  | ({ type: 'dictionary'; word: string; label?: string } & Partial<DictionaryRelationEndpoint>)
  | Partial<ExternalLinkRelationEndpoint>
  | Partial<WordRelationEndpoint>

export type LegacyRelation = Omit<Partial<Relation>, 'endpoints'> & {
  id: string
  endpoints: [LegacyRelationEndpoint, LegacyRelationEndpoint]
  type: RelationType
  direction: RelationDirection
  label?: string
  createdAt: number
  updatedAt: number
}

const directionalTypes: RelationType[] = ['references', 'explains', 'mentions']
const nonDirectionalTypes: RelationType[] = ['linked', 'contrasts', 'annotates', 'externalLink']

const relationLabels: Record<RelationType, string> = {
  linked: 'studyRelations.type.linked',
  references: 'studyRelations.type.references',
  explains: 'studyRelations.type.explains',
  contrasts: 'studyRelations.type.contrasts',
  mentions: 'studyRelations.type.mentions',
  annotates: 'studyRelations.type.annotates',
  externalLink: 'studyRelations.type.externalLink',
}

const passiveRelationLabels: Record<
  Extract<RelationType, 'references' | 'explains' | 'mentions'>,
  string
> = {
  references: 'studyRelations.type.referencedBy',
  explains: 'studyRelations.type.explainedBy',
  mentions: 'studyRelations.type.mentionedBy',
}

const endpointTypeLabels: Record<RelationEndpointType, string> = {
  verse: 'Passage',
  note: 'Note',
  study: 'Étude',
  strong: 'Strong',
  nave: 'Nave',
  dictionary: 'Dictionnaire',
  externalLink: 'Lien',
  word: 'Mot',
}

const parseVerseKey = (verseKey: string) => {
  const [book, chapter, verse] = verseKey.split('-').map(Number)
  if (!book || !chapter || !verse) return undefined
  return { book, chapter, verse }
}

const getEndpointLegacyLabel = (endpoint: LegacyRelationEndpoint): string | undefined =>
  'labelFallback' in endpoint
    ? endpoint.labelFallback
    : 'label' in endpoint
      ? endpoint.label
      : undefined

const getVerseReference = (verseKeys: string[]) => {
  const start = parseVerseKey(verseKeys[0])
  const end = parseVerseKey(verseKeys[verseKeys.length - 1])
  if (!start || !end) {
    return {
      start: { book: 0, chapter: 0, verse: 0 },
      end: { book: 0, chapter: 0, verse: 0 },
    }
  }
  return { start, end }
}

export const normalizeVerseKeys = (verseKeys: string[]): string[] => {
  const uniqueKeys = [...new Set(verseKeys)]
  return uniqueKeys.sort((a, b) => {
    const left = parseVerseKey(a)
    const right = parseVerseKey(b)
    if (!left || !right) return a.localeCompare(b)
    return left.book - right.book || left.chapter - right.chapter || left.verse - right.verse
  })
}

export const normalizeStrongCode = (code: string | number): string => {
  const trimmed = String(code).trim().toUpperCase()
  return trimmed.replace(/^[GH]/, '').replace(/^0+(\d)/, '$1')
}

export const getRelationPairKey = (endpoints: [RelationEndpoint, RelationEndpoint]): string =>
  endpoints.map(endpointIdentity).sort().join('|')

export const getRelationDuplicateKey = (
  endpoints: [RelationEndpoint, RelationEndpoint],
  type: RelationType
): string => `${type}:${getRelationPairKey(endpoints)}`

export const getRelationPairId = (duplicateKey: string): string => {
  let firstHash = 2166136261
  let secondHash = 0x811c9dc5

  for (let index = 0; index < duplicateKey.length; index += 1) {
    const code = duplicateKey.charCodeAt(index)
    firstHash ^= code
    firstHash = Math.imul(firstHash, 16777619)
    secondHash ^= code + index
    secondHash = Math.imul(secondHash, 1597334677)
  }

  return `pair_${(firstHash >>> 0).toString(36)}_${(secondHash >>> 0).toString(36)}`
}

export const getRelationProjections = (endpoints: [RelationEndpoint, RelationEndpoint]) => {
  const verseEndpoints = endpoints.filter(
    (endpoint): endpoint is VerseRelationEndpoint => endpoint.type === 'verse'
  )

  return {
    endpointKeys: endpoints.map(endpointIdentity) as [string, string],
    endpointTypes: endpoints.map(endpoint => endpoint.type) as [
      RelationEndpointType,
      RelationEndpointType,
    ],
    verseStartKeys: [
      ...new Set(verseEndpoints.map(endpoint => endpoint.verseKeys[0]).filter(Boolean)),
    ],
    verseEndpointKeys: verseEndpoints.map(endpointIdentity),
  }
}

export const normalizeRelationEndpoint = (endpoint: LegacyRelationEndpoint): RelationEndpoint => {
  switch (endpoint.type) {
    case 'verse': {
      const verseKeys = normalizeVerseKeys(endpoint.verseKeys || [])
      const key = `verse:${verseKeys.join('/')}`
      return {
        type: 'verse',
        key,
        verseKeys,
        reference: endpoint.reference || getVerseReference(verseKeys),
        labelFallback:
          endpoint.labelFallback || getEndpointLegacyLabel(endpoint) || verseToReference(verseKeys),
      }
    }
    case 'note': {
      const noteId = endpoint.noteId.trim()
      return {
        type: 'note',
        key: `note:${noteId}`,
        noteId,
        labelFallback: endpoint.labelFallback || getEndpointLegacyLabel(endpoint),
      }
    }
    case 'study': {
      const studyId = endpoint.studyId.trim()
      return {
        type: 'study',
        key: `study:${studyId}`,
        studyId,
        labelFallback: endpoint.labelFallback || getEndpointLegacyLabel(endpoint),
      }
    }
    case 'strong': {
      const code = normalizeStrongCode(endpoint.code)
      const labelFallback =
        endpoint.labelFallback ||
        getEndpointLegacyLabel(endpoint) ||
        endpoint.originalWord ||
        `${endpoint.language === 'greek' ? 'G' : 'H'}${code}`
      return {
        type: 'strong',
        key: `strong:${endpoint.language}:${code}`,
        language: endpoint.language,
        code,
        originalWord: endpoint.originalWord,
        labelFallback,
      }
    }
    case 'nave': {
      const nameLower = endpoint.nameLower.trim().toLowerCase()
      const resourceLanguage = endpoint.resourceLanguage || 'fr'
      return {
        type: 'nave',
        key: `nave:${resourceLanguage}:${nameLower}`,
        resourceLanguage,
        nameLower,
        labelFallback: endpoint.labelFallback || getEndpointLegacyLabel(endpoint),
      }
    }
    case 'dictionary': {
      const word = endpoint.word.trim()
      const resourceLanguage = endpoint.resourceLanguage || 'fr'
      return {
        type: 'dictionary',
        key: `dictionary:${resourceLanguage}:${word.toLowerCase()}`,
        resourceLanguage,
        word,
        labelFallback: endpoint.labelFallback || getEndpointLegacyLabel(endpoint),
      }
    }
    case 'externalLink': {
      const sourceKey = endpoint.sourceKey || ''
      const linkId = endpoint.linkId || sourceKey
      return {
        type: 'externalLink',
        key: endpoint.key || `externalLink:${linkId}`,
        sourceKey,
        linkId,
        url: endpoint.url || '',
        labelFallback: endpoint.labelFallback || getEndpointLegacyLabel(endpoint),
      }
    }
    case 'word': {
      const word = endpoint.word || ''
      const resourceLanguage = endpoint.resourceLanguage || 'fr'
      return {
        type: 'word',
        key: endpoint.key || `word:${resourceLanguage}:${word.toLowerCase()}`,
        resourceLanguage,
        word,
        labelFallback: endpoint.labelFallback || getEndpointLegacyLabel(endpoint),
      }
    }
    default:
      throw new Error('Unsupported relation endpoint')
  }
}

export const validateRelationDirection = (
  type: RelationType,
  direction: RelationDirection
): RelationDirection => {
  if (nonDirectionalTypes.includes(type)) return 'none'
  if (direction === 'none') return 'forward'
  return direction
}

export const normalizeRelation = (relation: LegacyRelation | Relation): Relation => {
  const endpoints = [
    normalizeRelationEndpoint(relation.endpoints[0]),
    normalizeRelationEndpoint(relation.endpoints[1]),
  ] as [RelationEndpoint, RelationEndpoint]
  const projections = getRelationProjections(endpoints)
  const pairKey = getRelationPairKey(endpoints)
  const duplicateKey = getRelationDuplicateKey(endpoints, relation.type)

  const normalized: Relation = {
    id: relation.id,
    kind: relation.kind || 'manual',
    type: relation.type,
    direction: validateRelationDirection(relation.type, relation.direction),
    endpoints,
    endpointKeys: projections.endpointKeys,
    endpointTypes: projections.endpointTypes,
    pairKey,
    duplicateKey,
    verseStartKeys: projections.verseStartKeys,
    verseEndpointKeys: projections.verseEndpointKeys,
    createdAt: relation.createdAt,
    updatedAt: relation.updatedAt,
    label: relation.label?.trim() || undefined,
  }

  if (relation.createdBy) normalized.createdBy = relation.createdBy
  if (relation.updatedBy) normalized.updatedBy = relation.updatedBy
  if (relation.deletedAt) normalized.deletedAt = relation.deletedAt

  return normalized
}

export const normalizeStudyRelation = normalizeRelation

export const endpointIdentity = (endpoint: LegacyRelationEndpoint): string =>
  normalizeRelationEndpoint(endpoint).key!

export const hasDuplicateRelation = (
  relations: RelationsObj,
  relation: Relation,
  ignoredRelationId?: string
): boolean =>
  Object.values(relations).some(existing => {
    if (existing.id === ignoredRelationId) return false
    return normalizeRelation(existing).duplicateKey === relation.duplicateKey
  })

export const hasDuplicateStudyRelation = hasDuplicateRelation

const relationDedupeScore = (relation: Relation): [number, number, number, string] => [
  relation.deletedAt ? 0 : 1,
  relation.kind === 'system' && relation.id.startsWith('system:') ? 1 : 0,
  relation.updatedAt || relation.createdAt || 0,
  relation.id,
]

const shouldReplaceDuplicateRelation = (current: Relation, candidate: Relation): boolean => {
  const currentScore = relationDedupeScore(current)
  const candidateScore = relationDedupeScore(candidate)

  for (let index = 0; index < candidateScore.length; index += 1) {
    if (candidateScore[index] === currentScore[index]) continue
    return candidateScore[index] > currentScore[index]
  }

  return false
}

export const dedupeRelationsByDuplicateKey = (relations: RelationsObj = {}): RelationsObj => {
  const byDuplicateKey = Object.values(relations).reduce(
    (result, relation) => {
      const normalized = normalizeRelation(relation)
      const current = result[normalized.duplicateKey]
      if (!current || shouldReplaceDuplicateRelation(current, normalized)) {
        result[normalized.duplicateKey] = normalized
      }
      return result
    },
    {} as Record<string, Relation>
  )

  return Object.values(byDuplicateKey).reduce((result, relation) => {
    result[relation.id] = relation
    return result
  }, {} as RelationsObj)
}

export const endpointsMatch = (left: RelationEndpoint, right: RelationEndpoint): boolean =>
  endpointIdentity(left) === endpointIdentity(right)

export const relationIncludesEndpoint = (relation: Relation, endpoint: RelationEndpoint): boolean =>
  relation.endpointKeys.includes(endpointIdentity(endpoint))

export const relationIncludesVerseKey = (relation: Relation, verseKey: string): boolean =>
  relation.endpoints.some(
    endpoint => endpoint.type === 'verse' && endpoint.verseKeys.includes(verseKey)
  )

export const createVerseEndpoint = (
  verseKeys: string[],
  labelFallback?: string
): RelationEndpoint => normalizeRelationEndpoint({ type: 'verse', verseKeys, labelFallback })

export const createNoteEndpoint = (noteId: string, labelFallback?: string): RelationEndpoint =>
  normalizeRelationEndpoint({ type: 'note', noteId, labelFallback })

export const createExternalLinkEndpoint = (
  sourceEndpoint: RelationEndpoint,
  linkId: string,
  link: Pick<Link, 'url' | 'customTitle' | 'ogData'>
): RelationEndpoint =>
  normalizeRelationEndpoint({
    type: 'externalLink',
    sourceKey: endpointIdentity(sourceEndpoint),
    linkId,
    url: link.url,
    labelFallback: link.customTitle || link.ogData?.title || link.url,
  })

export const createSystemRelation = (relation: {
  id: string
  type: Extract<RelationType, 'annotates' | 'externalLink'>
  endpoints: [RelationEndpoint, RelationEndpoint]
  label?: string
  createdAt: number
  updatedAt: number
}): Relation =>
  normalizeRelation({
    ...relation,
    kind: 'system',
    direction: 'none',
  })

export const getSystemRelationId = (
  type: Extract<RelationType, 'annotates' | 'externalLink'>,
  entityId: string,
  verseEndpoint: RelationEndpoint
): string => `system:${type}:${getRelationPairId(`${entityId}:${endpointIdentity(verseEndpoint)}`)}`

const getVerseKeysForNote = (noteId: string, wordAnnotations: WordAnnotationsObj = {}) => {
  if (noteId.startsWith('annotation:')) {
    const annotationId = noteId.replace('annotation:', '')
    const annotation = wordAnnotations[annotationId]
    return normalizeVerseKeys(annotation?.ranges.map(range => range.verseKey) || [])
  }

  return normalizeVerseKeys(noteId.split('/').filter(key => Boolean(parseVerseKey(key))))
}

export const buildSystemRelationsForNotes = (
  notes: Record<string, Note> = {},
  wordAnnotations: WordAnnotationsObj = {}
): RelationsObj =>
  Object.entries(notes).reduce((relations, [noteId, note]) => {
    const verseKeys = getVerseKeysForNote(noteId, wordAnnotations)
    if (verseKeys.length === 0) return relations

    const noteEndpoint = createNoteEndpoint(noteId, getNoteTitle(note, ''))
    const verseEndpoint = createVerseEndpoint(verseKeys, verseKeys.join('/'))
    const relation = createSystemRelation({
      id: getSystemRelationId('annotates', noteId, verseEndpoint),
      type: 'annotates',
      endpoints: [noteEndpoint, verseEndpoint],
      createdAt: note.date,
      updatedAt: note.date,
    })
    relations[relation.id] = relation
    return relations
  }, {} as RelationsObj)

export const buildSystemRelationsForLinks = (links: Record<string, Link> = {}): RelationsObj =>
  Object.entries(links).reduce((relations, [linkKey, link]) => {
    const verseKeys = normalizeVerseKeys(
      linkKey.split('/').filter(key => Boolean(parseVerseKey(key)))
    )
    if (verseKeys.length === 0) return relations
    const verseEndpoint = createVerseEndpoint(verseKeys, verseKeys.join('/'))
    const externalLinkEndpoint = createExternalLinkEndpoint(verseEndpoint, linkKey, link)
    const relation = createSystemRelation({
      id: getSystemRelationId('externalLink', linkKey, verseEndpoint),
      type: 'externalLink',
      endpoints: [externalLinkEndpoint, verseEndpoint],
      createdAt: link.date,
      updatedAt: link.date,
    })
    relations[relation.id] = relation
    return relations
  }, {} as RelationsObj)

export const mergeRelationsWithSystemBackfill = ({
  relations = {},
  notes = {},
  links = {},
  wordAnnotations,
  preserveExistingSystemRelations = false,
}: {
  relations?: RelationsObj
  notes?: Record<string, Note>
  links?: Record<string, Link>
  wordAnnotations?: WordAnnotationsObj
  preserveExistingSystemRelations?: boolean
}): RelationsObj => {
  const preservedRelations = Object.values(relations).reduce((result, relation) => {
    if (relation.kind !== 'system') {
      result[relation.id] = relation
      return result
    }

    if (preserveExistingSystemRelations) {
      result[relation.id] = relation
      return result
    }

    const noteEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'note')
    if (noteEndpoint?.type === 'note' && notes[noteEndpoint.noteId]) {
      const annotationId = noteEndpoint.noteId.startsWith('annotation:')
        ? noteEndpoint.noteId.replace('annotation:', '')
        : undefined
      if (!annotationId || wordAnnotations?.[annotationId]) {
        result[relation.id] = relation
      }
      return result
    }

    const linkEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'externalLink')
    if (linkEndpoint?.type === 'externalLink' && links[linkEndpoint.linkId]) {
      result[relation.id] = relation
    }
    return result
  }, {} as RelationsObj)

  return dedupeRelationsByDuplicateKey({
    ...preservedRelations,
    ...buildSystemRelationsForNotes(notes, wordAnnotations),
    ...buildSystemRelationsForLinks(links),
  })
}

export const rebuildRelationIndexes = (relations: RelationsObj): RelationIndexObj => {
  const index: RelationIndexObj = {}

  for (const relation of Object.values(relations)) {
    if (relation.deletedAt) continue

    for (const endpoint of relation.endpoints) {
      const endpointKey = endpointIdentity(endpoint)
      const otherEndpoint = relation.endpoints.find(item => !endpointsMatch(item, endpoint))
      const current = index[endpointKey] || {
        entityKey: endpointKey,
        totalCount: 0,
        countsByType: {},
        countsByEntityType: {},
        updatedAt: 0,
      }

      current.totalCount += 1
      current.countsByType = {
        ...current.countsByType,
        [relation.type]: (current.countsByType?.[relation.type] || 0) + 1,
      }
      if (otherEndpoint) {
        current.countsByEntityType = {
          ...current.countsByEntityType,
          [otherEndpoint.type]: (current.countsByEntityType?.[otherEndpoint.type] || 0) + 1,
        }
      }
      current.updatedAt = Math.max(current.updatedAt, relation.updatedAt)
      index[endpointKey] = current
    }
  }

  return index
}

export const rebuildRelationPairs = (relations: RelationsObj): RelationPairsObj =>
  Object.values(relations).reduce((pairs, relation) => {
    if (!relation.deletedAt) {
      const basePairId = getRelationPairId(relation.duplicateKey)
      let pairId = basePairId
      let collisionIndex = 1

      while (pairs[pairId] && pairs[pairId].duplicateKey !== relation.duplicateKey) {
        pairId = `${basePairId}_${collisionIndex}`
        collisionIndex += 1
      }

      pairs[pairId] = {
        duplicateKey: relation.duplicateKey,
        relationId: relation.id,
        createdAt: relation.createdAt,
      }
    }
    return pairs
  }, {} as RelationPairsObj)

export const getEndpointFallbackLabel = (endpoint: RelationEndpoint): string => {
  const normalizedEndpoint = normalizeRelationEndpoint(endpoint)

  switch (normalizedEndpoint.type) {
    case 'verse':
      return (
        verseToReference(normalizedEndpoint.verseKeys) ||
        normalizedEndpoint.labelFallback ||
        i18n.t('Passage supprimé')
      )
    case 'note':
      return normalizedEndpoint.labelFallback || i18n.t('Note supprimée')
    case 'study':
      return normalizedEndpoint.labelFallback || i18n.t('Étude supprimée')
    case 'strong':
      return (
        normalizedEndpoint.labelFallback ||
        `${normalizedEndpoint.language === 'greek' ? 'G' : 'H'}${normalizedEndpoint.code}`
      )
    case 'nave':
      return (
        normalizedEndpoint.labelFallback || normalizedEndpoint.nameLower || i18n.t('Nave supprimé')
      )
    case 'dictionary':
      return normalizedEndpoint.labelFallback || normalizedEndpoint.word || i18n.t('Mot supprimé')
    case 'externalLink':
      return normalizedEndpoint.labelFallback || normalizedEndpoint.url || i18n.t('Lien supprimé')
    case 'word':
      return normalizedEndpoint.labelFallback || normalizedEndpoint.word || i18n.t('Mot supprimé')
  }
}

export const getResolvedEndpointLabel = (
  endpoint: RelationEndpoint,
  data: {
    notes?: Record<string, Note>
    studies?: Record<string, Study>
    links?: Record<string, Link>
    strongsGrec?: Record<string, unknown>
    strongsHebreu?: Record<string, unknown>
    naves?: Record<string, unknown>
    words?: Record<string, unknown>
  } = {}
): { label: string; isAvailable: boolean } => {
  switch (endpoint.type) {
    case 'verse':
      return { label: getEndpointFallbackLabel(endpoint), isAvailable: true }
    case 'note': {
      const note = data.notes?.[endpoint.noteId]
      return {
        label: getNoteTitle(note, getEndpointFallbackLabel(endpoint)),
        isAvailable: Boolean(note),
      }
    }
    case 'study': {
      const study = data.studies?.[endpoint.studyId]
      return {
        label: study?.title || getEndpointFallbackLabel(endpoint),
        isAvailable: Boolean(study),
      }
    }
    case 'strong': {
      const source = endpoint.language === 'greek' ? data.strongsGrec : data.strongsHebreu
      const strong = source?.[endpoint.code] as { title?: string; Mot?: string } | undefined
      return {
        label: strong?.Mot || strong?.title || getEndpointFallbackLabel(endpoint),
        isAvailable: Boolean(strong) || Boolean(endpoint.labelFallback || endpoint.originalWord),
      }
    }
    case 'nave': {
      const nave = data.naves?.[endpoint.nameLower] as { title?: string; name?: string } | undefined
      return {
        label: nave?.name || nave?.title || getEndpointFallbackLabel(endpoint),
        isAvailable: Boolean(nave) || Boolean(endpoint.labelFallback),
      }
    }
    case 'dictionary':
    case 'word': {
      const word = data.words?.[endpoint.word] as { title?: string } | undefined
      return {
        label: word?.title || getEndpointFallbackLabel(endpoint),
        isAvailable: Boolean(word) || Boolean(endpoint.labelFallback),
      }
    }
    case 'externalLink': {
      const link = data.links?.[endpoint.linkId]
      return {
        label:
          link?.customTitle ||
          link?.ogData?.title ||
          endpoint.labelFallback ||
          link?.url ||
          endpoint.url ||
          i18n.t('Lien supprimé'),
        isAvailable: Boolean(link) || Boolean(endpoint.url),
      }
    }
  }
}

export const getRelationText = (relation: Relation, activeEndpoint: RelationEndpoint): string => {
  if (!directionalTypes.includes(relation.type)) {
    return i18n.t(relationLabels[relation.type])
  }

  const activeIsSource =
    (relation.direction === 'forward' && endpointsMatch(activeEndpoint, relation.endpoints[0])) ||
    (relation.direction === 'backward' && endpointsMatch(activeEndpoint, relation.endpoints[1]))

  if (activeIsSource) return i18n.t(relationLabels[relation.type])
  return i18n.t(passiveRelationLabels[relation.type as 'references' | 'explains' | 'mentions'])
}

export const getRelationDisplayModel = (
  relation: Relation,
  activeEndpoint: RelationEndpoint,
  data?: Parameters<typeof getResolvedEndpointLabel>[1]
): RelationDisplayModel | undefined => {
  const activeKey = endpointIdentity(activeEndpoint)
  const targetEndpoint = relation.endpoints.find(
    endpoint => endpointIdentity(endpoint) !== activeKey
  )
  if (!targetEndpoint) return undefined

  const target = getResolvedEndpointLabel(targetEndpoint, data)
  const active = getResolvedEndpointLabel(activeEndpoint, data)
  const relationText = getRelationText(relation, activeEndpoint)

  return {
    relation,
    activeEndpoint,
    targetEndpoint,
    targetLabel: target.label,
    isTargetAvailable: target.isAvailable,
    relationText,
    title: relation.label || `${active.label} ${relationText} ${target.label}`,
    subtitle: `${i18n.t(endpointTypeLabels[targetEndpoint.type])}${target.isAvailable ? '' : ` ${i18n.t('indisponible')}`}`,
  }
}

export const getBookName = (bookNumber: number): string =>
  books[bookNumber - 1]?.Nom || i18n.t('Livre {{bookNumber}}', { bookNumber })
