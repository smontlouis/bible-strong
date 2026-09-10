import { getBook } from '~helpers/bibleBookCatalog'
import { osisToBibleReferenceTarget, parseInlineBibleReferences } from '~helpers/bcvParser'
import { normalizeOsisReference } from '~helpers/osisReference'
import verseToReference from '~helpers/verseToReference'
import type { HTMLViewLinkPayload } from '~common/htmlContentTypes'

export type PreviewSelection = {
  book: number
  chapter: number
  start?: number
  end?: number
}
export type ReferencePreviewTarget = {
  selections: PreviewSelection[]
  title: string
  version?: string
}

const validSelection = ({ book, chapter, start, end }: PreviewSelection) => {
  const entry = getBook(book)
  return (
    !!entry &&
    Number.isInteger(chapter) &&
    chapter > 0 &&
    chapter <= entry.Chapitres &&
    (start === undefined || (Number.isInteger(start) && start > 0)) &&
    (end === undefined || (Number.isInteger(end) && end >= (start ?? 1)))
  )
}
const pointLabel = (selection: PreviewSelection) =>
  verseToReference({
    bookNum: selection.book,
    chapterNum: selection.chapter,
    verses: selection.start === undefined ? undefined : [selection.start],
  })

export function parsePreviewOsis(value: string): ReferencePreviewTarget | undefined {
  const selections: PreviewSelection[] = []
  const labels: string[] = []
  for (const segment of normalizeOsisReference(value).split(',')) {
    const [from, to] = segment.split('-')
    if (!/^[\w]+\.\d+(?:\.\d+)?$/u.test(from ?? '') || (to && !/^[\w]+\.\d+(?:\.\d+)?$/u.test(to)))
      return
    const first = osisToBibleReferenceTarget(from)
    const last = to ? osisToBibleReferenceTarget(to) : first
    if (!first || !last || first.book !== last.book || last.chapter < first.chapter) return
    const start = from.split('.')[2] === undefined ? undefined : Number(from.split('.')[2])
    const end =
      (to ?? from).split('.')[2] === undefined ? undefined : Number((to ?? from).split('.')[2])
    for (let chapter = first.chapter; chapter <= last.chapter; chapter++) {
      const selection = {
        book: first.book,
        chapter,
        start: chapter === first.chapter ? start : undefined,
        end: chapter === last.chapter ? end : undefined,
      }
      if (!validSelection(selection)) return
      selections.push(selection)
    }
    const label = pointLabel({ book: first.book, chapter: first.chapter, start })
    labels.push(
      to
        ? `${label}–${first.chapter === last.chapter && end !== undefined ? end : `${last.chapter}${end === undefined ? '' : `:${end}`}`}`
        : label
    )
  }
  return selections.length ? { selections, title: labels.join('; ') } : undefined
}

export function parseReferencePreviewLink({
  href,
  type,
}: Pick<HTMLViewLinkPayload, 'href' | 'type'>): ReferencePreviewTarget | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(href).replaceAll('\u00a0', ' ').trim()
  } catch {
    return
  }
  if (decoded.startsWith('v=')) {
    const match = /^v=(\d+)-(\d+)-([\d,]+)$/u.exec(decoded)
    if (!match) return
    const book = Number(match[1]),
      chapter = Number(match[2])
    const verses = [...new Set(match[3].split(',').map(Number))]
    const selections = verses.map(verse => ({ book, chapter, start: verse, end: verse }))
    if (!selections.every(validSelection)) return
    return { selections, title: verseToReference({ bookNum: book, chapterNum: chapter, verses }) }
  }
  if (/^(?:https?:|mailto:|strong:|#|w=)/iu.test(decoded)) return
  const [path, query] = decoded.split('?')
  const version = query ? (new URLSearchParams(query).get('version') ?? undefined) : undefined
  const target = parsePreviewOsis(
    path
      .replace(/^bible:\/\//iu, '')
      .replace(/^\/+|\/+$/gu, '')
      .replaceAll('_', '.')
  )
  if (target) return { ...target, version }
  if (!type.includes('verse')) return
  const reference = parseInlineBibleReferences(decoded.replace(/(\d+)\.(\d+)$/u, '$1:$2'))[0]
  return reference ? parsePreviewOsis(reference.target.osis) : undefined
}
