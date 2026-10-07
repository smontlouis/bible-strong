import type { BibleChapterDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import { escapeHtml, sanitizeEditorialHtml } from '../resources/editorialHtml'

type ChapterVerse = BibleChapterDto['verses'][number]
type LayoutTag = { tag: string; attributes?: Readonly<Record<string, string>> }

/** Trusted markup placed at a position of a verse, such as the Strong numbers of a word. */
export type BibleTextMarker = { offset: number; html: string }

export type BibleNote = { id: number; verse: number; html: string }

export type RenderedBibleText = { html: string; notes: BibleNote[] }

type RenderOptions = {
  verseHref: (verse: number) => string
  verseLabel: (verse: number) => string
  markersByVerse?: ReadonlyMap<number, readonly BibleTextMarker[]>
  /** The page a cross-reference of a note opens, from its OSIS reference. */
  referenceHref?: (osisReference: string) => string | undefined
  /** Section titles belong to a chapter reading, not to a quoted passage. */
  includeHeadings: boolean
  /**
   * Trusted blocks read between the verses, such as the comments of a commentary: each
   * after the verse it is keyed by, and the one keyed by 0 before the first verse.
   */
  blocksAfterVerse?: ReadonlyMap<number, string>
}

type BlockTag = 'p' | 'lg' | 'l'
type InlineElement = { key: string; open: string; close: string }
type LayoutEvent = { offset: number; order: number } & (
  | { kind: 'block-open'; tag: BlockTag; level?: string }
  | { kind: 'block-close'; tag: BlockTag }
  | { kind: 'inline-open'; element: InlineElement }
  | { kind: 'inline-close'; key: string }
  | { kind: 'note'; markup: string }
  | { kind: 'marker'; html: string }
  | { kind: 'heading'; text: string; type: string }
)

const BLOCK_CLOSE: Record<BlockTag, string> = { p: '</p>', lg: '</div>', l: '</span>' }

const isBlockTag = (tag: string): tag is BlockTag => tag === 'p' || tag === 'lg' || tag === 'l'

/** The inline formatting kept from the canonical text; unknown tags are transparent. */
const inlineElement = ({ tag, attributes }: LayoutTag): InlineElement | undefined => {
  const className =
    tag === 'wj' || tag === 'red'
      ? 'wj'
      : tag === 'divineName'
        ? 'divine-name'
        : tag === 'i'
          ? attributes?.type === 'bold'
            ? 'bold'
            : 'added'
          : undefined
  return className
    ? { key: tag, open: `<span class="bible-${className}">`, close: '</span>' }
    : undefined
}

/**
 * Some sources mark poetry with milestones (`sid` opens, `eid` closes) rather than with
 * a pair of tags; both spellings describe the same structure.
 */
const eventBoundary = (
  type: 'open' | 'close' | 'self',
  attributes: LayoutTag['attributes']
): 'open' | 'close' | undefined => {
  if (type !== 'self') return type
  if (attributes?.sid) return 'open'
  return attributes?.eid ? 'close' : undefined
}

const verseEvents = (
  verse: ChapterVerse,
  markers: readonly BibleTextMarker[],
  includeHeadings: boolean
): LayoutEvent[] => {
  const events: LayoutEvent[] = []
  for (const event of verse.presentation.layout) {
    const boundary = eventBoundary(event.type, event.attributes)
    if (!boundary) continue
    const position = { offset: event.offset, order: event.order }
    if (isBlockTag(event.tag)) {
      events.push(
        boundary === 'open'
          ? { ...position, kind: 'block-open', tag: event.tag, level: event.attributes?.level }
          : { ...position, kind: 'block-close', tag: event.tag }
      )
      continue
    }
    const element = inlineElement(event)
    if (!element) continue
    events.push(
      boundary === 'open'
        ? { ...position, kind: 'inline-open', element }
        : { ...position, kind: 'inline-close', key: element.key }
    )
  }
  for (const note of verse.presentation.notes) {
    events.push({ offset: note.offset, order: note.order, kind: 'note', markup: note.markup })
  }
  if (includeHeadings) {
    for (const heading of verse.presentation.headings) {
      events.push({
        offset: heading.offset,
        order: heading.order,
        kind: 'heading',
        text: heading.text,
        type: heading.type,
      })
    }
  }
  for (const marker of markers) {
    // A marker follows its word: before whatever else happens at that position.
    events.push({ offset: marker.offset, order: -1, kind: 'marker', html: marker.html })
  }
  return events.sort(
    (left, right) =>
      left.offset - right.offset ||
      left.order - right.order ||
      // A title and its own note share a position: the title is printed first.
      Number(right.kind === 'heading') - Number(left.kind === 'heading')
  )
}

const REFERENCE_SCHEME = 'bible://'

/**
 * A note keeps its inline formatting; its cross-references (`<ref id="Mark.3.13">`) become
 * links when the page knows where they lead.
 */
const noteHtml = (markup: string, referenceHref: RenderOptions['referenceHref']): string =>
  sanitizeEditorialHtml(
    markup
      .replace(/<ref\b[^>]*?\bid="([^"]*)"[^>]*>/gu, `<a href="${REFERENCE_SCHEME}$1">`)
      .replace(/<\/ref>/gu, '</a>'),
    {
      resolveHref: href =>
        href.startsWith(REFERENCE_SCHEME)
          ? referenceHref?.(href.slice(REFERENCE_SCHEME.length))
          : undefined,
    }
  )

const hasBlockStructure = (verses: readonly ChapterVerse[]): boolean =>
  verses.some(
    verse =>
      verse.presentation.startTags.some(tag => isBlockTag(tag.tag)) ||
      verse.presentation.layout.some(event => isBlockTag(event.tag))
  )

/**
 * Renders verses as reading text: paragraphs, poetry stanzas and lines, words of Jesus,
 * section titles and note marks. A version without paragraph marks gets one paragraph per
 * verse. Blocks and inline formatting are tracked separately and inline formatting is
 * reopened in each block, so the markup stays well formed however the source nests it.
 */
export const renderBibleText = (
  verses: readonly ChapterVerse[],
  {
    verseHref,
    verseLabel,
    markersByVerse,
    referenceHref,
    includeHeadings,
    blocksAfterVerse,
  }: RenderOptions
): RenderedBibleText => {
  const out: string[] = []
  const notes: BibleNote[] = []
  const blocks: BlockTag[] = []
  const inline: InlineElement[] = []
  // How many elements of `inline`, from the bottom, are currently open in the output.
  let emitted = 0
  let pendingVerse: number | undefined
  // Whether the open block already holds text, so the next verse needs a separating space.
  let blockHasText = false
  // A stanza interrupted by a block read between two verses goes on after that block.
  let resumeStanza = false
  const structured = hasBlockStructure(verses)

  const suspendInline = () => {
    while (emitted > 0) out.push(inline[--emitted]?.close ?? '')
  }
  const closeBlock = (tag: BlockTag) => {
    if (tag === 'lg') resumeStanza = false
    const index = blocks.lastIndexOf(tag)
    if (index === -1) return
    suspendInline()
    while (blocks.length > index) out.push(BLOCK_CLOSE[blocks.pop() as BlockTag])
    blockHasText = false
  }
  const closeAllBlocks = () => {
    suspendInline()
    while (blocks.length) out.push(BLOCK_CLOSE[blocks.pop() as BlockTag])
    blockHasText = false
  }
  const resumeInterruptedStanza = () => {
    if (!resumeStanza) return
    resumeStanza = false
    if (blocks.length) return
    out.push('<div class="bible-lg">')
    blocks.push('lg')
  }
  const openBlock = (tag: BlockTag, level?: string) => {
    if (tag === 'l') {
      resumeInterruptedStanza()
      closeBlock('l')
      suspendInline()
      const indent = /^[2-4]$/u.test(level ?? '') ? ` bible-l--${level}` : ''
      out.push(`<span class="bible-l${indent}">`)
    } else {
      // Paragraphs and stanzas are the two top-level blocks of a reading.
      resumeStanza = false
      closeAllBlocks()
      out.push(tag === 'p' ? '<p class="bible-p">' : '<div class="bible-lg">')
    }
    blocks.push(tag)
    blockHasText = false
  }
  const openInline = (element: InlineElement) => inline.push(element)
  const closeInline = (key: string) => {
    const index = inline.findLastIndex(element => element.key === key)
    if (index === -1) return
    while (emitted > index) out.push(inline[--emitted]?.close ?? '')
    inline.splice(index, 1)
  }
  /** Opens what a piece of content needs around it: a block, then the verse number. */
  const enterContent = () => {
    resumeInterruptedStanza()
    if (!blocks.length) {
      out.push(structured ? '<p class="bible-p">' : '<p class="bible-p bible-p--verse">')
      blocks.push('p')
    }
    if (pendingVerse !== undefined) {
      if (blockHasText) out.push(' ')
      out.push(
        `<a id="v${pendingVerse}" class="bible-verse-number" href="${escapeHtml(
          verseHref(pendingVerse)
        )}" aria-label="${escapeHtml(verseLabel(pendingVerse))}">${pendingVerse}</a>`
      )
      pendingVerse = undefined
    }
  }
  const emitText = (text: string) => {
    // White space between two blocks, or between two lines of a stanza, is not content.
    if (!text || (!text.trim() && (!blocks.length || blocks.at(-1) === 'lg'))) return
    enterContent()
    while (emitted < inline.length) out.push(inline[emitted++]?.open ?? '')
    out.push(escapeHtml(text))
    blockHasText = true
  }
  /** Ends what is being read, prints a block, and lets the reading go on after it. */
  const emitBlock = (html: string | undefined) => {
    if (!html) return
    const inStanza = blocks[0] === 'lg'
    closeAllBlocks()
    out.push(html)
    resumeStanza = inStanza
  }

  verses.forEach((verse, verseIndex) => {
    if (verseIndex === 0) {
      emitBlock(blocksAfterVerse?.get(0))
      // Whatever was opened before the first verse rendered is still open here.
      for (const tag of verse.presentation.startTags) {
        if (isBlockTag(tag.tag)) openBlock(tag.tag, tag.attributes?.level)
        else {
          const element = inlineElement(tag)
          if (element) openInline(element)
        }
      }
    }
    if (!structured) closeAllBlocks()
    pendingVerse = verse.number

    let position = 0
    for (const event of verseEvents(verse, markersByVerse?.get(verse.number) ?? [], includeHeadings)) {
      const offset = Math.min(Math.max(event.offset, position), verse.text.length)
      emitText(verse.text.slice(position, offset))
      position = offset
      switch (event.kind) {
        case 'block-open':
          openBlock(event.tag, event.level)
          break
        case 'block-close':
          closeBlock(event.tag)
          break
        case 'inline-open':
          openInline(event.element)
          break
        case 'inline-close':
          closeInline(event.key)
          break
        case 'heading':
          resumeStanza = false
          closeAllBlocks()
          out.push(
            `<h2 class="bible-heading bible-heading--${event.type.replace(/[^a-zA-Z]/gu, '')}">${escapeHtml(
              event.text
            )}</h2>`
          )
          break
        case 'marker':
          enterContent()
          out.push(event.html)
          blockHasText = true
          break
        case 'note': {
          const id = notes.length + 1
          notes.push({ id, verse: verse.number, html: noteHtml(event.markup, referenceHref) })
          enterContent()
          out.push(
            // A plain link to the note under the text; where the browser supports popovers,
            // a click shows the note next to its mark instead.
            `<a id="note-ref-${id}" class="bible-note-ref" href="#note-${id}" data-note="${id}" role="doc-noteref" aria-label="Note ${id}">${id}</a>`
          )
          break
        }
      }
    }
    emitText(verse.text.slice(position))
    emitBlock(blocksAfterVerse?.get(verse.number))
  })
  closeAllBlocks()

  return { html: out.join(''), notes }
}
