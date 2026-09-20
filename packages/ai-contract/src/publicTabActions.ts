/** Only public editorial destinations; no user-owned identifiers or arbitrary routes. */
type Language = 'fr' | 'en'
type PublicTargets = {
  strong: {
    kind: 'strong'
    code?: string
    identityKind?: 'strong' | 'dstrong' | 'estrong' | 'ustrong'
  }
  dictionary: {
    kind: 'dictionary'
    language: Language
    work?: string
    entryId?: number
    word?: string
  }
  nave: { kind: 'nave'; language: Language; normalizedName?: string }
  commentary: { kind: 'commentary'; book: number; chapter: number; verse: number }
  'commentary-resource': {
    kind: 'commentary-resource'
    resourceId: string
    language: Language
    book: number
    chapter: number
    sectionId?: string
  }
  timeline: { kind: 'timeline'; language: Language; eventSlug?: string }
  search: { kind: 'search'; query: string }
  plan: { kind: 'reading'; planId: string; readingId?: string }
}
export type PublicTabType = keyof PublicTargets
export type PublicOpenTabAction = {
  [K in PublicTabType]: { id: string; kind: 'open_tab'; tabType: K; target: PublicTargets[K] }
}[PublicTabType]

type Field = {
  type: 'string' | 'integer'
  enum?: readonly string[]
  pattern?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
}
type TargetSchema = {
  type: 'object'
  properties: Record<string, Field>
  required: readonly string[]
  additionalProperties: false
}
const text = (maxLength = 200): Field => ({
  type: 'string',
  minLength: 1,
  maxLength,
  pattern: '^[^\\u0000-\\u001f\\u007f]+$',
})
const identifier: Field = { ...text(), pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$' }
const resourceId: Field = { ...text(100), pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }
const language: Field = { type: 'string', enum: ['fr', 'en'] }
const book: Field = { type: 'integer', minimum: 1, maximum: 77 }
const chapter: Field = { type: 'integer', minimum: 1, maximum: 150 }
const schema = (
  kind: string,
  properties: Record<string, Field>,
  required: string[] = []
): TargetSchema => ({
  type: 'object',
  properties: { kind: { type: 'string', enum: [kind] }, ...properties },
  required: ['kind', ...required],
  additionalProperties: false,
})
export const PUBLIC_TAB_TARGET_SCHEMAS: Record<PublicTabType, TargetSchema> = {
  strong: schema('strong', {
    code: { ...text(10), pattern: '^[GH][0-9]{1,5}[A-Z]{0,4}$' },
    identityKind: { type: 'string', enum: ['strong', 'dstrong', 'estrong', 'ustrong'] },
  }),
  dictionary: schema(
    'dictionary',
    {
      language,
      work: resourceId,
      entryId: { type: 'integer', minimum: 1, maximum: 10000000 },
      word: text(300),
    },
    ['language']
  ),
  nave: schema('nave', { language, normalizedName: text(300) }, ['language']),
  commentary: schema(
    'commentary',
    { book, chapter, verse: { type: 'integer', minimum: 1, maximum: 176 } },
    ['book', 'chapter', 'verse']
  ),
  'commentary-resource': schema(
    'commentary-resource',
    { resourceId, language, book, chapter, sectionId: identifier },
    ['resourceId', 'language', 'book', 'chapter']
  ),
  timeline: schema(
    'timeline',
    { language, eventSlug: { ...text(), pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' } },
    ['language']
  ),
  search: schema('search', { query: text(300) }, ['query']),
  plan: schema('reading', { planId: identifier, readingId: identifier }, ['planId']),
}

export function parsePublicTabAction(
  id: string,
  tabType: unknown,
  value: unknown
): PublicOpenTabAction {
  const fail = (): never => {
    throw new Error('INVALID_ACTION')
  }
  if (typeof tabType !== 'string' || !Object.hasOwn(PUBLIC_TAB_TARGET_SCHEMAS, tabType))
    return fail()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const target = value as Record<string, unknown>
  const definition = PUBLIC_TAB_TARGET_SCHEMAS[tabType as PublicTabType]
  if (definition.required.some(key => !Object.hasOwn(target, key))) return fail()
  for (const [key, fieldValue] of Object.entries(target)) {
    if (!Object.hasOwn(definition.properties, key)) return fail()
    const field = definition.properties[key]
    if (field.type === 'integer') {
      if (
        typeof fieldValue !== 'number' ||
        !Number.isSafeInteger(fieldValue) ||
        fieldValue < field.minimum! ||
        fieldValue > field.maximum!
      )
        return fail()
    } else if (
      typeof fieldValue !== 'string' ||
      !fieldValue.trim() ||
      (field.enum && !field.enum.includes(fieldValue)) ||
      (field.minLength !== undefined && fieldValue.length < field.minLength) ||
      (field.maxLength !== undefined && fieldValue.length > field.maxLength) ||
      (field.pattern && !new RegExp(field.pattern, 'u').test(fieldValue))
    )
      return fail()
  }
  if (tabType === 'strong' && target.identityKind && !target.code) return fail()
  if (
    tabType === 'dictionary' &&
    (target.entryId !== undefined || target.word !== undefined) &&
    (!target.work || target.entryId === undefined || !target.word)
  )
    return fail()
  return { id, kind: 'open_tab', tabType, target: { ...target } } as PublicOpenTabAction
}
