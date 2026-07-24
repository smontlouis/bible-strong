import type { Verse } from '~common/types'

export type CanonicalVersePresentationNode =
  | { kind: 'text'; text: string }
  | { kind: 'strong-reference'; reference: string }
  | { kind: 'paragraph-start'; offset: number }
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
  strongSpans = [],
  redWordRanges = [],
}: CanonicalVersePresentationInput): CanonicalVersePresentationNode[] => {
  const root: PresentationContainer = { children: [] }
  const stack: PresentationContainer[] = [root]
  for (const activeTag of startTags) {
    if (isParagraphTag(activeTag.tag)) {
      openTransparentElement(stack, activeTag.tag)
    } else {
      openElement(stack, activeTag.tag, activeTag.attributes)
    }
  }

  const eventsByOffset = new Map<number, NonNullable<Verse['Layout']>>()
  for (const event of layout) {
    const offset = clampOffset(event.offset, text.length)
    const events = eventsByOffset.get(offset) ?? []
    events.push(event)
    eventsByOffset.set(offset, events)
  }
  for (const events of eventsByOffset.values()) {
    events.sort((left, right) => left.order - right.order)
  }

  const referencesByOffset = new Map<number, string[]>()
  for (const span of strongSpans) {
    if (span.length <= 0 || span.startOffset < 0 || span.startOffset + span.length > text.length) {
      continue
    }
    const offset = span.startOffset + span.length
    const references = referencesByOffset.get(offset) ?? []
    for (const identity of span.identities) {
      if (identity.kind !== 'strong') continue
      const reference = identity.code.match(/\d+/u)?.[0]
      if (reference) references.push(String(Number(reference)))
    }
    referencesByOffset.set(offset, [...new Set(references)])
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
    ...referencesByOffset.keys(),
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
    for (const reference of referencesByOffset.get(offset) ?? []) {
      currentChildren(stack).push({ kind: 'strong-reference', reference })
    }
    for (const event of eventsByOffset.get(offset) ?? []) {
      if (event.type === 'open') {
        if (isParagraphTag(event.tag)) {
          currentChildren(stack).push({ kind: 'paragraph-start', offset })
          openTransparentElement(stack, event.tag)
        } else {
          openElement(stack, event.tag, event.attributes)
        }
      } else if (event.type === 'close') {
        closeElement(stack, event.tag)
      } else {
        currentChildren(stack).push({
          kind: 'element',
          tag: event.tag,
          attributes: event.attributes,
          children: [],
        })
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

const currentChildren = (stack: PresentationContainer[]) => stack[stack.length - 1]!.children

const isParagraphTag = (tag: string) => tag.toLocaleLowerCase() === 'p'

const openTransparentElement = (stack: PresentationContainer[], tag: string) => {
  stack.push({ tag, children: currentChildren(stack) })
}

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
