import type { Verse } from '~common/types'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import {
  areStrongIdentitiesEqual,
  getDisplayedStrongIdentities,
  type StrongIdentity,
} from '~helpers/strongIdentities'
import { getStrongSelectionWordFromTextSegment } from './strongSelectionAction'

export type CanonicalVersePresentationNode =
  | { kind: 'text'; text: string }
  | { kind: 'strong-reference'; identities: StrongIdentity[]; word: string }
  | { kind: 'paragraph-start'; offset: number }
  | { kind: 'line-start'; offset: number }
  | { kind: 'note-reference'; note: CanonicalBibleNote }
  | {
      kind: 'element'
      tag: string
      attributes?: Record<string, string>
      children: CanonicalVersePresentationNode[]
    }

interface CanonicalVersePresentationInput {
  text: string
  startTags?: Verse['StartTags']
  layout?: Verse['Layout']
  notes?: Verse['Notes']
  strongSpans?: Verse['StrongSpans']
  redWordRanges?: Array<{ start: number; end: number }>
}

interface PresentationContainer {
  tag?: string
  children: CanonicalVersePresentationNode[]
}

export const buildCanonicalVersePresentation = ({
  text,
  startTags = [],
  layout = [],
  notes = [],
  strongSpans = [],
  redWordRanges = [],
}: CanonicalVersePresentationInput): CanonicalVersePresentationNode[] => {
  const root: PresentationContainer = { children: [] }
  const stack: PresentationContainer[] = [root]
  for (const activeTag of startTags) {
    openElement(stack, activeTag.tag, activeTag.attributes)
  }

  type PresentationEvent =
    | { kind: 'layout'; order: number; event: NonNullable<Verse['Layout']>[number] }
    | { kind: 'note'; order: number; note: CanonicalBibleNote }
  const eventsByOffset = new Map<number, PresentationEvent[]>()
  for (const event of layout) {
    const offset = clampOffset(event.offset, text.length)
    const events = eventsByOffset.get(offset) ?? []
    events.push({ kind: 'layout', order: event.order, event })
    eventsByOffset.set(offset, events)
  }
  for (const note of notes) {
    const offset = clampOffset(note.offset, text.length)
    const events = eventsByOffset.get(offset) ?? []
    events.push({ kind: 'note', order: note.order, note: { ...note, offset } })
    eventsByOffset.set(offset, events)
  }
  for (const events of eventsByOffset.values()) {
    events.sort((left, right) => left.order - right.order)
  }

  const strongReferencesByOffset = new Map<number, { identities: StrongIdentity[]; word: string }>()
  for (const span of strongSpans) {
    if (span.length <= 0 || span.startOffset < 0 || span.startOffset + span.length > text.length) {
      continue
    }
    const offset = span.startOffset + span.length
    const strongReference = strongReferencesByOffset.get(offset) ?? {
      identities: [],
      word: text.slice(span.startOffset, offset),
    }
    for (const identity of getDisplayedStrongIdentities(span.identities)) {
      if (
        !strongReference.identities.some(candidate => areStrongIdentitiesEqual(candidate, identity))
      ) {
        strongReference.identities.push(identity)
      }
    }
    strongReferencesByOffset.set(offset, strongReference)
  }
  let previousStrongOffset = 0
  for (const [offset, strongReference] of [...strongReferencesByOffset.entries()].sort(
    ([left], [right]) => left - right
  )) {
    strongReference.word =
      getStrongSelectionWordFromTextSegment(text.slice(previousStrongOffset, offset)) ??
      strongReference.word
    previousStrongOffset = offset
  }

  const redStarts = new Map<number, number>()
  const redEnds = new Map<number, number>()
  for (const range of toCharacterRanges(text, redWordRanges)) {
    const start = clampOffset(range.start, text.length)
    const end = clampOffset(range.end, text.length)
    if (end <= start) continue
    redStarts.set(start, (redStarts.get(start) ?? 0) + 1)
    redEnds.set(end, (redEnds.get(end) ?? 0) + 1)
  }

  const boundaries = [
    0,
    text.length,
    ...eventsByOffset.keys(),
    ...strongReferencesByOffset.keys(),
    ...redStarts.keys(),
    ...redEnds.keys(),
  ].sort((left, right) => left - right)

  let previousOffset = 0
  for (const offset of [...new Set(boundaries)]) {
    if (offset > previousOffset) {
      currentChildren(stack).push({
        kind: 'text',
        text: text.slice(previousOffset, offset),
      })
    }
    for (let index = 0; index < (redEnds.get(offset) ?? 0); index += 1) {
      closeElement(stack, 'red-word')
    }
    const strongReference = strongReferencesByOffset.get(offset)
    if (strongReference?.identities.length) {
      currentChildren(stack).push({ kind: 'strong-reference', ...strongReference })
    }
    for (const presentationEvent of eventsByOffset.get(offset) ?? []) {
      if (presentationEvent.kind === 'note') {
        currentChildren(stack).push({
          kind: 'note-reference',
          note: presentationEvent.note,
        })
        continue
      }
      const { event } = presentationEvent
      if (event.type === 'open') {
        if (isParagraphTag(event.tag)) {
          currentChildren(stack).push({ kind: 'paragraph-start', offset })
          openElement(stack, event.tag, event.attributes)
        } else if (isLineStartTag(event.tag)) {
          currentChildren(stack).push({ kind: 'line-start', offset })
          openElement(stack, event.tag, event.attributes)
        } else if (isPoeticLineGroupTag(event.tag)) {
          openElement(stack, event.tag, event.attributes)
        } else {
          openElement(stack, event.tag, event.attributes)
        }
      } else if (event.type === 'close') {
        closeElement(stack, event.tag)
      } else {
        if (isLineBreakSpan(event.tag, event.attributes)) {
          currentChildren(stack).push({ kind: 'line-start', offset })
        } else {
          currentChildren(stack).push({
            kind: 'element',
            tag: event.tag,
            attributes: event.attributes,
            children: [],
          })
        }
      }
    }
    for (let index = 0; index < (redStarts.get(offset) ?? 0); index += 1) {
      openElement(stack, 'red-word')
    }
    previousOffset = offset
  }

  return root.children
}

export const getCanonicalPresentationText = (nodes: CanonicalVersePresentationNode[]): string =>
  nodes
    .map(node => {
      if (node.kind === 'text') return node.text
      if (node.kind === 'strong-reference') return ''
      if (node.kind === 'paragraph-start') return ''
      if (node.kind === 'line-start') return ''
      if (node.kind === 'note-reference') return ''
      return getCanonicalPresentationText(node.children)
    })
    .join('')

export const shouldInsertCanonicalParagraphBreak = ({
  offset,
  verse,
  textDisplay,
}: {
  offset: number
  verse: string | number
  textDisplay: 'inline' | 'block'
}) => offset > 0 || (Number(verse) !== 1 && textDisplay === 'inline')

export const shouldInsertCanonicalBlockBreakBeforeVerse = ({
  layout = [],
  verse,
  textDisplay,
}: {
  layout?: Verse['Layout']
  verse: string | number
  textDisplay: 'inline' | 'block'
}) =>
  layout.some(
    event =>
      event.type === 'open' &&
      isBlockStartEvent(event) &&
      clampOffset(event.offset, Number.MAX_SAFE_INTEGER) === 0
  ) &&
  shouldInsertCanonicalParagraphBreak({
    offset: 0,
    verse,
    textDisplay,
  })

const currentChildren = (stack: PresentationContainer[]) => stack[stack.length - 1]!.children

const isParagraphTag = (tag: string) => tag.toLocaleLowerCase() === 'p'
const isPoeticLineTag = (tag: string) => tag.toLocaleLowerCase() === 'l'
const isListItemTag = (tag: string) => tag.toLocaleLowerCase() === 'item'
const isLineStartTag = (tag: string) => isPoeticLineTag(tag) || isListItemTag(tag)
const isPoeticLineGroupTag = (tag: string) => tag.toLocaleLowerCase() === 'lg'
const isBlockStartTag = (tag: string) => isParagraphTag(tag) || isLineStartTag(tag)
const isLineBreakSpan = (tag: string, attributes?: Record<string, string>) =>
  tag.toLocaleLowerCase() === 'span' &&
  (attributes?.type === 'x-p' || attributes?.['data-osis-tag'] === 'lb')
const isBlockStartEvent = (event: NonNullable<Verse['Layout']>[number]) =>
  (event.type === 'open' && isBlockStartTag(event.tag)) ||
  (event.type === 'self' && isLineBreakSpan(event.tag, event.attributes))

const openElement = (
  stack: PresentationContainer[],
  tag: string,
  attributes?: Record<string, string>
) => {
  const element: Extract<CanonicalVersePresentationNode, { kind: 'element' }> = {
    kind: 'element',
    tag,
    attributes,
    children: [],
  }
  currentChildren(stack).push(element)
  stack.push(element)
}

const closeElement = (stack: PresentationContainer[], tag: string) => {
  const normalizedTag = tag.toLocaleLowerCase()
  for (let index = stack.length - 1; index > 0; index -= 1) {
    if (stack[index]!.tag?.toLocaleLowerCase() === normalizedTag) {
      stack.length = index
      return
    }
  }
}

const clampOffset = (offset: number, length: number) =>
  Math.max(0, Math.min(Number.isFinite(offset) ? offset : 0, length))

const toCharacterRanges = (
  text: string,
  ranges: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> => {
  const words = [...text.matchAll(/\S+/gu)].map(match => ({
    start: match.index,
    end: match.index + match[0].length,
  }))

  return ranges.flatMap(range => {
    const first = words[range.start]
    const last = words[Math.min(range.end, words.length - 1)]
    if (!first || !last || range.end < range.start) return []
    return [{ start: first.start, end: last.end }]
  })
}
