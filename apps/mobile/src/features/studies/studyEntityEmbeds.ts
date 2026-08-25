import type { SearchEntityResultWithEndpoint } from '~features/search/shared/searchResultTypes'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import i18n from '~i18n'

export type StudyEntityDisplay = {
  typeLabel: string
  title: string
  subtitle?: string
  description?: string
  chip?: string
}

const entityTypeTranslationKeys: Record<RelationEndpoint['type'], string> = {
  verse: 'Passage',
  note: 'Note',
  study: 'Étude',
  strong: 'Strong',
  nave: 'Nave',
  dictionary: 'Dictionnaire',
  externalLink: 'Lien',
  annotation: 'Annotation',
  word: 'Mot',
}

export const getStudyEntityTypeLabel = (endpoint: RelationEndpoint): string =>
  i18n.t(entityTypeTranslationKeys[endpoint.type])

export type StudyEntityEmbedPayload = {
  schemaVersion: 1
  endpoint: RelationEndpoint
  fallback: StudyEntityDisplay
  display: StudyEntityDisplay
}

const normalizeDisplayText = (value: string): string => value.trim().replace(/\s+/gu, ' ')

const isDuplicateDisplayText = (
  value: string | undefined,
  display: StudyEntityDisplay
): boolean => {
  if (!value) return true
  const normalizedValue = normalizeDisplayText(value).toLocaleLowerCase()
  return [display.typeLabel, display.title]
    .filter(Boolean)
    .some(candidate => normalizeDisplayText(candidate).toLocaleLowerCase() === normalizedValue)
}

export const getStudyEntityBlockDescription = (
  payload: StudyEntityEmbedPayload
): string | undefined => {
  const { endpoint, display } = payload

  switch (endpoint.type) {
    case 'note':
    case 'study':
    case 'dictionary':
    case 'nave':
      return undefined
    case 'externalLink':
      return endpoint.url
    case 'annotation':
    case 'word':
      return isDuplicateDisplayText(display.description, display) ? undefined : display.description
    case 'verse':
    case 'strong':
      return undefined
  }
}

export const createStudyEntityEmbedPayload = (
  target: SearchEntityResultWithEndpoint
): StudyEntityEmbedPayload => ({
  schemaVersion: 1,
  endpoint: target.endpoint,
  fallback: {
    typeLabel: getStudyEntityTypeLabel(target.endpoint),
    title: target.title,
    ...(target.subtitle && { subtitle: target.subtitle }),
    ...(target.description && { description: target.description }),
    ...(target.chip && { chip: target.chip }),
  },
  display: {
    typeLabel: getStudyEntityTypeLabel(target.endpoint),
    title: target.title,
    ...(target.subtitle && { subtitle: target.subtitle }),
    ...(target.description && { description: target.description }),
    ...(target.chip && { chip: target.chip }),
  },
})
