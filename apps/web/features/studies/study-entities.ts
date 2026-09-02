export const studyEntityTypes = [
  'verse',
  'note',
  'study',
  'strong',
  'nave',
  'dictionary',
  'externalLink',
  'annotation',
  'word',
] as const

export type StudyEntityType = (typeof studyEntityTypes)[number]

export type StudyEntityDisplay = {
  typeLabel: string
  title: string
  subtitle?: string
  description?: string
  chip?: string
}

export type StudyEntityEndpoint = {
  type: StudyEntityType
  [key: string]: unknown
}

export type StudyEntityEmbedPayload = {
  schemaVersion: 1
  endpoint: StudyEntityEndpoint
  fallback: StudyEntityDisplay
  display: StudyEntityDisplay
}

type ConverterOperation = {
  attributes?: Record<string, unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEntityType = (value: unknown): value is StudyEntityType =>
  typeof value === 'string' && studyEntityTypes.includes(value as StudyEntityType)

const namedHtmlEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"',
}

const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/giu, (entity, code: string) => {
    if (!code.startsWith('#')) return namedHtmlEntities[code.toLowerCase()] ?? entity
    const isHexadecimal = code[1]?.toLowerCase() === 'x'
    const codePoint = Number.parseInt(code.slice(isHexadecimal ? 2 : 1), isHexadecimal ? 16 : 10)
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity
    return String.fromCodePoint(codePoint)
  })

const readOptionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? decodeHtmlEntities(value.trim()) : undefined

const readDisplay = (value: unknown): StudyEntityDisplay | null => {
  if (!isRecord(value)) return null
  const typeLabel = readOptionalText(value.typeLabel)
  const title = readOptionalText(value.title)
  if (!typeLabel || !title) return null

  return {
    typeLabel,
    title,
    ...(readOptionalText(value.subtitle) && { subtitle: readOptionalText(value.subtitle) }),
    ...(readOptionalText(value.description) && {
      description: readOptionalText(value.description),
    }),
    ...(readOptionalText(value.chip) && { chip: readOptionalText(value.chip) }),
  }
}

export const readStudyEntityPayload = (value: unknown): StudyEntityEmbedPayload | null => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.endpoint)) return null
  if (!isEntityType(value.endpoint.type)) return null

  const fallback = readDisplay(value.fallback)
  const display = readDisplay(value.display) ?? fallback
  if (!fallback || !display) return null

  return {
    schemaVersion: 1,
    endpoint: { ...value.endpoint, type: value.endpoint.type },
    fallback,
    display,
  }
}

export const serializeStudyEntityPayload = (payload: StudyEntityEmbedPayload): string =>
  encodeURIComponent(JSON.stringify(payload))

export const deserializeStudyEntityPayload = (value: string): StudyEntityEmbedPayload | null => {
  try {
    return readStudyEntityPayload(JSON.parse(decodeURIComponent(value)))
  } catch {
    return null
  }
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>'"]/gu,
    character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!,
  )

const normalizeText = (value: string): string => value.replace(/\s+/gu, ' ').trim().toLowerCase()

const getDescription = (payload: StudyEntityEmbedPayload): string | undefined => {
  const { endpoint, display } = payload
  if (endpoint.type === 'externalLink') return readOptionalText(endpoint.url)
  if (endpoint.type !== 'annotation' && endpoint.type !== 'word') return undefined
  if (!display.description) return undefined

  const description = normalizeText(display.description)
  return [display.typeLabel, display.title].some(value => normalizeText(value) === description)
    ? undefined
    : display.description
}

const getSafeExternalUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export const getStudyEntityLink = (
  payload: StudyEntityEmbedPayload,
): { href: string; external?: true } | undefined => {
  if (payload.endpoint.type === 'externalLink') {
    const href = getSafeExternalUrl(payload.endpoint.url)
    return href ? { href, external: true } : undefined
  }
  if (payload.endpoint.type === 'study') {
    const studyId = readOptionalText(payload.endpoint.studyId)
    return studyId ? { href: `/studies/${encodeURIComponent(studyId)}` } : undefined
  }
  return undefined
}

const entityIcons: Record<StudyEntityType, string> = {
  verse: '¶',
  note: '✎',
  study: '§',
  strong: 'א',
  nave: 'N',
  dictionary: 'A',
  externalLink: '↗',
  annotation: '¶',
  word: 'A',
}

const renderMeta = (display: StudyEntityDisplay): string => {
  const values = [display.chip, display.subtitle].filter(
    (value, index, all): value is string =>
      Boolean(value) &&
      normalizeText(value!) !== normalizeText(display.title) &&
      all.indexOf(value) === index,
  )
  if (!values.length) return ''
  return `<span class="block-entity__meta">${values
    .map(value => `<span>${escapeHtml(value)}</span>`)
    .join('')}</span>`
}

export const renderStudyEntityBlock = (value: unknown): string => {
  const payload = readStudyEntityPayload(value)
  if (!payload) {
    return '<span class="block-entity block-entity--unsupported" role="note">Référence indisponible</span>'
  }

  const { endpoint, display } = payload
  const description = getDescription(payload)
  const serializedPayload = serializeStudyEntityPayload(payload)

  return `<button type="button" class="block-entity block-entity--${endpoint.type}" data-entity-type="${endpoint.type}" data-study-entity="${serializedPayload}">
    <span class="block-entity__type"><span class="block-entity__icon" aria-hidden="true">${entityIcons[endpoint.type]}</span>${escapeHtml(display.typeLabel)}</span>
    <strong class="block-entity__title">${escapeHtml(display.title)}</strong>
    ${renderMeta(display)}
    ${description ? `<span class="block-entity__description">${escapeHtml(description)}</span>` : ''}
    <span class="block-entity__arrow" aria-hidden="true">→</span>
  </button>`
}

const readInlinePayload = (operation: ConverterOperation): StudyEntityEmbedPayload | null =>
  readStudyEntityPayload(operation.attributes?.['inline-entity'])

export const getStudyEntityInlineAttributes = (
  operation: ConverterOperation,
): Record<string, string> => {
  const payload = readInlinePayload(operation)
  if (!payload) return { title: 'Référence indisponible' }

  return {
    title: `${payload.display.typeLabel} — ${payload.display.title}`,
    'data-entity-type': payload.endpoint.type,
    'data-study-entity': serializeStudyEntityPayload(payload),
    type: 'button',
  }
}

export const getStudyEntityInlineClasses = (operation: ConverterOperation): string[] => {
  const type = readInlinePayload(operation)?.endpoint.type
  return type ? ['inline-entity', `inline-entity--${type}`] : ['inline-entity']
}
