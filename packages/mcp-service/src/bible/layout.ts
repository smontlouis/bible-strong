import type { BibleChapterDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type { TextPart, VerseView } from '../cards/types'

type ChapterVerse = BibleChapterDto['verses'][number]
type Attributes = Readonly<Record<string, string>> | undefined

type Mark = 'wj' | 'i' | 'b'

/** The inline formatting kept from the canonical text; any other tag is transparent. */
const markOf = (tag: string, attributes: Attributes): Mark | undefined => {
  if (tag === 'wj' || tag === 'red') return 'wj'
  if (tag === 'i') return attributes?.type === 'bold' ? 'b' : 'i'
  return undefined
}

/** Some sources mark poetry with milestones (`sid` opens, `eid` closes) instead of a pair. */
const boundaryOf = (type: 'open' | 'close' | 'self', attributes: Attributes) => {
  if (type !== 'self') return type
  if (attributes?.sid) return 'open'
  return attributes?.eid ? 'close' : undefined
}

const isBlock = (tag: string) => tag === 'p' || tag === 'lg' || tag === 'l'

/**
 * Reads verses of a chapter as a card draws them: their text, cut where the words of Jesus
 * or added words start and end, the paragraphs and poetry lines they open, and the section
 * titles printed before them. A version that marks no paragraph is read one verse a line.
 */
export const readVerses = (
  verses: readonly ChapterVerse[],
  { headings }: { headings: boolean }
): VerseView[] => {
  const marksBlocks = verses.some(verse =>
    verse.presentation.layout.some(event => isBlock(event.tag))
  )
  const open = new Map<Mark, number>()
  // What was already open when the first verse starts, such as words of Jesus begun earlier.
  for (const start of verses[0]?.presentation.startTags ?? []) {
    const mark = markOf(start.tag, start.attributes)
    if (mark) open.set(mark, (open.get(mark) ?? 0) + 1)
  }

  return verses.map((verse, index) => {
    const parts: TextPart[] = []
    let paragraph = !marksBlocks
    let position = 0

    const pushText = (end: number) => {
      const text = verse.text.slice(position, end)
      position = end
      if (!text) return
      parts.push({
        text,
        ...(open.get('wj') ? { wj: true as const } : {}),
        ...(open.get('i') ? { i: true as const } : {}),
        ...(open.get('b') ? { b: true as const } : {}),
      })
    }

    const events = [...verse.presentation.layout].sort(
      (left, right) => left.offset - right.offset || left.order - right.order
    )
    for (const event of events) {
      const boundary = boundaryOf(event.type, event.attributes)
      if (!boundary) continue
      pushText(Math.min(event.offset, verse.text.length))
      if (isBlock(event.tag)) {
        if (boundary !== 'open') continue
        const breakKind = event.tag === 'l' ? 'line' : 'paragraph'
        if (parts.length) parts.push({ br: breakKind })
        else if (breakKind === 'paragraph' || index > 0) paragraph = true
        continue
      }
      const mark = markOf(event.tag, event.attributes)
      if (!mark) continue
      const count = open.get(mark) ?? 0
      open.set(mark, boundary === 'open' ? count + 1 : Math.max(0, count - 1))
    }
    pushText(verse.text.length)
    // A break at the very end belongs to the next verse.
    while (parts.at(-1) && 'br' in parts.at(-1)!) parts.pop()

    const heading = headings
      ? verse.presentation.headings
          .map(item => item.text.trim())
          .filter(Boolean)
          .join(' · ')
      : ''

    return {
      number: verse.number,
      parts,
      ...(heading ? { heading } : {}),
      ...(paragraph || heading ? { paragraph: true as const } : {}),
    }
  })
}

/** The text of a verse on one line, as it is quoted. */
export const quoteText = (text: string): string => text.replace(/\s+/gu, ' ').trim()

/** A verse the version numbers but leaves blank holds nothing to read. */
export const hasText = (text: string): boolean => /[\p{L}\p{N}]/u.test(text)
