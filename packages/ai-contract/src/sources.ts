export type StudySource = {
  id: string
  title: string
  excerpt: string
  version?: string
  kind: 'passage' | 'strong' | 'commentary' | 'dictionary'
  params: Record<string, string>
}
const fields: Record<StudySource['kind'], string[]> = {
  passage: ['book', 'chapter', 'start', 'end'],
  strong: ['code', 'identityKind'],
  commentary: ['resourceId', 'book', 'chapter', 'sectionId'],
  dictionary: ['work', 'entryId', 'word'],
}
export function parseStudySource(value: unknown): StudySource {
  if (!value || typeof value !== 'object') throw new Error('INVALID_SOURCE')
  const v = value as StudySource
  if (
    !/^s[1-6]$/.test(v.id) ||
    typeof v.title !== 'string' ||
    v.title.length > 300 ||
    typeof v.excerpt !== 'string' ||
    v.excerpt.length > 1200 ||
    !Object.hasOwn(fields, v.kind) ||
    !v.params ||
    typeof v.params !== 'object' ||
    Array.isArray(v.params)
  )
    throw new Error('INVALID_SOURCE')
  if (
    v.version !== undefined &&
    (typeof v.version !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(v.version))
  )
    throw new Error('INVALID_SOURCE')
  const keys = fields[v.kind]
  if (
    Object.keys(v.params).length !== keys.length ||
    keys.some(
      key => typeof v.params[key] !== 'string' || !v.params[key] || v.params[key].length > 300
    )
  )
    throw new Error('INVALID_SOURCE')
  const number = (key: string, max: number) =>
    /^\d+$/.test(v.params[key]) && Number(v.params[key]) >= 1 && Number(v.params[key]) <= max
  if (
    (v.kind === 'passage' || v.kind === 'commentary') &&
    (!number('book', 66) || !number('chapter', 150))
  )
    throw new Error('INVALID_SOURCE')
  if (
    v.kind === 'passage' &&
    (!number('start', 176) || !number('end', 176) || Number(v.params.end) < Number(v.params.start))
  )
    throw new Error('INVALID_SOURCE')
  if (
    v.kind === 'strong' &&
    (!/^[GH]\d{1,5}[A-Z]{0,4}$/i.test(v.params.code) ||
      !['strong', 'dstrong', 'estrong', 'ustrong'].includes(v.params.identityKind))
  )
    throw new Error('INVALID_SOURCE')
  if (v.kind === 'commentary' && !['acbc', 'barnes', 'aquifer-fr'].includes(v.params.resourceId))
    throw new Error('INVALID_SOURCE')
  if (
    v.kind === 'dictionary' &&
    (!['bost', 'calmet', 'lelievre', 'westphal'].includes(v.params.work) ||
      !number('entryId', 10000000))
  )
    throw new Error('INVALID_SOURCE')
  return {
    id: v.id,
    title: v.title,
    excerpt: v.excerpt,
    ...(v.version ? { version: v.version } : {}),
    kind: v.kind,
    params: Object.fromEntries(keys.map(key => [key, v.params[key]])),
  }
}
export const sourceLink = (id: string) => `https://bible-strong.app/assistant-source/${id}`
export function sourceIdFromLink(href: string): string | undefined {
  try {
    const url = new URL(href)
    return url.origin === 'https://bible-strong.app' &&
      /^\/assistant-source\/s[1-6]$/.test(url.pathname) &&
      !url.search &&
      !url.hash
      ? url.pathname.split('/').pop()
      : undefined
  } catch {
    return undefined
  }
}
