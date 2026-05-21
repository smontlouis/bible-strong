import books from '~assets/bible_versions/books-desc'
import type { Note, Study } from '~redux/modules/user'
import verseToReference from '~helpers/verseToReference'

export type RelationType = 'linked' | 'references' | 'explains' | 'contrasts'
export type RelationDirection = 'none' | 'forward' | 'backward'
export type RelationEndpointType = 'verse' | 'note' | 'study' | 'strong'

export type VerseRelationEndpoint = {
  type: 'verse'
  verseKeys: string[]
  label?: string
}

export type NoteRelationEndpoint = {
  type: 'note'
  noteId: string
  label?: string
}

export type StudyRelationEndpoint = {
  type: 'study'
  studyId: string
  label?: string
}

export type StrongRelationEndpoint = {
  type: 'strong'
  language: 'greek' | 'hebrew'
  code: string
  label?: string
  originalWord?: string
}

export type RelationEndpoint =
  | VerseRelationEndpoint
  | NoteRelationEndpoint
  | StudyRelationEndpoint
  | StrongRelationEndpoint

export type StudyRelation = {
  id: string
  endpoints: [RelationEndpoint, RelationEndpoint]
  type: RelationType
  direction: RelationDirection
  label?: string
  createdAt: number
  updatedAt: number
}

export type StudyRelationsObj = Record<string, StudyRelation>

export type RelationDisplayModel = {
  relation: StudyRelation
  activeEndpoint: RelationEndpoint
  targetEndpoint: RelationEndpoint
  title: string
  subtitle: string
  relationText: string
  targetLabel: string
  isTargetAvailable: boolean
}

const directionalTypes: RelationType[] = ['references', 'explains']
const nonDirectionalTypes: RelationType[] = ['linked', 'contrasts']

const relationLabels: Record<RelationType, string> = {
  linked: 'lié à',
  references: 'renvoie vers',
  explains: 'explique',
  contrasts: 'contraste avec',
}

const passiveRelationLabels: Record<Extract<RelationType, 'references' | 'explains'>, string> = {
  references: 'référencé par',
  explains: 'expliqué par',
}

const endpointTypeLabels: Record<RelationEndpointType, string> = {
  verse: 'Passage',
  note: 'Note',
  study: 'Étude',
  strong: 'Strong',
}

const parseVerseKey = (verseKey: string) => {
  const [book, chapter, verse] = verseKey.split('-').map(Number)
  if (!book || !chapter || !verse) return undefined
  return { book, chapter, verse }
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

export const normalizeRelationEndpoint = (endpoint: RelationEndpoint): RelationEndpoint => {
  switch (endpoint.type) {
    case 'verse': {
      const verseKeys = normalizeVerseKeys(endpoint.verseKeys)
      return {
        ...endpoint,
        verseKeys,
        label: endpoint.label || verseToReference(verseKeys),
      }
    }
    case 'note':
      return {
        ...endpoint,
        noteId: endpoint.noteId.trim(),
      }
    case 'study':
      return {
        ...endpoint,
        studyId: endpoint.studyId.trim(),
      }
    case 'strong':
      return {
        ...endpoint,
        code: normalizeStrongCode(endpoint.code),
        label:
          endpoint.label ||
          endpoint.originalWord ||
          `${endpoint.language === 'greek' ? 'G' : 'H'}${normalizeStrongCode(endpoint.code)}`,
      }
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

export const normalizeStudyRelation = (relation: StudyRelation): StudyRelation => ({
  ...relation,
  endpoints: [
    normalizeRelationEndpoint(relation.endpoints[0]),
    normalizeRelationEndpoint(relation.endpoints[1]),
  ],
  direction: validateRelationDirection(relation.type, relation.direction),
  label: relation.label?.trim() || undefined,
})

export const endpointIdentity = (endpoint: RelationEndpoint): string => {
  const normalized = normalizeRelationEndpoint(endpoint)
  switch (normalized.type) {
    case 'verse':
      return `verse:${normalized.verseKeys.join('/')}`
    case 'note':
      return `note:${normalized.noteId}`
    case 'study':
      return `study:${normalized.studyId}`
    case 'strong':
      return `strong:${normalized.language}:${normalized.code}`
  }
}

export const getRelationDuplicateKey = (
  endpoints: [RelationEndpoint, RelationEndpoint],
  type: RelationType
): string => {
  const [left, right] = endpoints.map(endpointIdentity).sort()
  return `${type}:${left}<->${right}`
}

export const hasDuplicateStudyRelation = (
  relations: StudyRelationsObj,
  relation: StudyRelation,
  ignoredRelationId?: string
): boolean => {
  const duplicateKey = getRelationDuplicateKey(relation.endpoints, relation.type)
  return Object.values(relations).some(existing => {
    if (existing.id === ignoredRelationId) return false
    return getRelationDuplicateKey(existing.endpoints, existing.type) === duplicateKey
  })
}

export const endpointsMatch = (left: RelationEndpoint, right: RelationEndpoint): boolean =>
  endpointIdentity(left) === endpointIdentity(right)

export const relationIncludesEndpoint = (
  relation: StudyRelation,
  endpoint: RelationEndpoint
): boolean =>
  relation.endpoints.some(relationEndpoint => endpointsMatch(relationEndpoint, endpoint))

export const relationIncludesVerseKey = (relation: StudyRelation, verseKey: string): boolean =>
  relation.endpoints.some(
    endpoint => endpoint.type === 'verse' && endpoint.verseKeys.includes(verseKey)
  )

export const getEndpointFallbackLabel = (endpoint: RelationEndpoint): string => {
  if (endpoint.label) return endpoint.label
  switch (endpoint.type) {
    case 'verse':
      return verseToReference(endpoint.verseKeys)
    case 'note':
      return 'Note supprimée'
    case 'study':
      return 'Étude supprimée'
    case 'strong':
      return `${endpoint.language === 'greek' ? 'G' : 'H'}${endpoint.code}`
  }
}

export const getResolvedEndpointLabel = (
  endpoint: RelationEndpoint,
  data: {
    notes?: Record<string, Note>
    studies?: Record<string, Study>
    strongsGrec?: Record<string, unknown>
    strongsHebreu?: Record<string, unknown>
  } = {}
): { label: string; isAvailable: boolean } => {
  switch (endpoint.type) {
    case 'verse':
      return { label: getEndpointFallbackLabel(endpoint), isAvailable: true }
    case 'note': {
      const note = data.notes?.[endpoint.noteId]
      return {
        label: note?.title || note?.description || getEndpointFallbackLabel(endpoint),
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
        isAvailable: Boolean(strong) || Boolean(endpoint.label || endpoint.originalWord),
      }
    }
  }
}

export const getRelationText = (
  relation: StudyRelation,
  activeEndpoint: RelationEndpoint
): string => {
  if (!directionalTypes.includes(relation.type)) {
    return relationLabels[relation.type]
  }

  const activeIsSource =
    (relation.direction === 'forward' && endpointsMatch(activeEndpoint, relation.endpoints[0])) ||
    (relation.direction === 'backward' && endpointsMatch(activeEndpoint, relation.endpoints[1]))

  if (activeIsSource) return relationLabels[relation.type]
  return passiveRelationLabels[relation.type as 'references' | 'explains']
}

export const getRelationDisplayModel = (
  relation: StudyRelation,
  activeEndpoint: RelationEndpoint,
  data?: Parameters<typeof getResolvedEndpointLabel>[1]
): RelationDisplayModel | undefined => {
  const targetEndpoint = relation.endpoints.find(
    endpoint => !endpointsMatch(endpoint, activeEndpoint)
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
    subtitle: `${endpointTypeLabels[targetEndpoint.type]}${target.isAvailable ? '' : ' indisponible'}`,
  }
}

export const getBookName = (bookNumber: number): string =>
  books[bookNumber - 1]?.Nom || `Livre ${bookNumber}`
