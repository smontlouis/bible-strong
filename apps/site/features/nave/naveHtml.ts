import { editorialHtmlToText, sanitizeEditorialHtml } from '../resources/editorialHtml'
import {
  naveReferenceLinks,
  parseNaveVerseTarget,
  resolveNaveHref,
  type NaveLinkContext,
  type NaveVerseReference,
} from './naveReferences'

// A topic is an outline: entries holding lines of text and the lists of their sub-entries.
type NaveBlock = string | NaveEntry[]
type NaveEntry = { blocks: NaveBlock[] }
type NaveFrame = { kind: 'root' | 'p' | 'li'; entry: NaveEntry } | { kind: 'ul'; list: NaveEntry[] }

const LINK_END_PATTERN = /<\/a\s*>/iu
const HREF_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu
const LIST_TAGS = new Set(['ul', 'ol'])
// Formatting that stays inside a line.
const INLINE_TAGS = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 'small', 'cite', 'sup', 'sub'])
// Tags that end a line; lists, their entries and paragraphs also shape the outline. Any
// other tag is dropped and its text kept.
const BLOCK_TAGS = new Set([
  ...LIST_TAGS,
  ...['li', 'p', 'br', 'hr', 'div', 'blockquote', 'table', 'tr', 'dl', 'dt', 'dd'],
  ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
])

export type NaveDescription = {
  /** The outline as nested lists, safe to inject. */
  html: string
  /** The sub-topics of the first level, as plain text. */
  headings: string[]
  /** How many Bible references the topic cites. */
  referenceCount: number
  /** The passages it cites, in the order of the outline. */
  references: NaveVerseReference[]
}

/**
 * Reads the two dialects topics are published in into one outline.
 *
 * The English publication nests `<ul>` lists whose `<li>` are rarely closed and separates
 * them with stray `<p>`; the French one nests `<p>` inside `<p>`. Both mean the same tree:
 * an entry is a sub-topic, a `<br>` ends its name and starts its references.
 */
const parseNaveOutline = (
  html: string,
  language: NaveLinkContext['language']
): { blocks: NaveBlock[]; references: NaveVerseReference[] } => {
  const root: NaveEntry = { blocks: [] }
  const stack: NaveFrame[] = [{ kind: 'root', entry: root }]
  let line = ''
  const references: NaveVerseReference[] = []

  // The entry text and lists are added to. What a list holds between two of its entries
  // continues the one before it.
  const currentEntry = (): NaveEntry => {
    const frame = stack[stack.length - 1] as NaveFrame
    if (frame.kind !== 'ul') return frame.entry
    const last = frame.list.at(-1)
    if (last) return last
    const entry: NaveEntry = { blocks: [] }
    frame.list.push(entry)
    return entry
  }
  const endLine = () => {
    const text = line.replace(/\s+/gu, ' ').trim()
    line = ''
    if (text) currentEntry().blocks.push(text)
  }
  const openList = (): NaveEntry[] => {
    const list: NaveEntry[] = []
    currentEntry().blocks.push(list)
    stack.push({ kind: 'ul', list })
    return list
  }
  const openEntry = (kind: 'p' | 'li', list: NaveEntry[]) => {
    const entry: NaveEntry = { blocks: [] }
    list.push(entry)
    stack.push({ kind, entry })
  }
  const closeThrough = (kind: NaveFrame['kind']) => {
    const openedAt = stack.findLastIndex(frame => frame.kind === kind)
    if (openedAt > 0) stack.length = openedAt
  }

  const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gu
  let position = 0
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    line += html.slice(position, match.index)
    position = pattern.lastIndex
    const closing = match[1] === '/'
    const tag = match[2]?.toLowerCase() ?? ''

    if (tag === 'a' && !closing) {
      const source = HREF_PATTERN.exec(match[0])
      const href = source?.[1] ?? source?.[2] ?? source?.[3] ?? ''
      const reference = href.startsWith('v=') ? parseNaveVerseTarget(href.slice(2)) : undefined
      const end = reference ? LINK_END_PATTERN.exec(html.slice(position)) : null
      if (reference && end) {
        // The label of a verse link is rebuilt from its target: both publications print the
        // French book names, and a list of verses becomes one link per passage.
        line += naveReferenceLinks(reference, language)
          .map(link => `<a href="v=${link.target}">${link.label}</a>`)
          .join(',')
        position += end.index + end[0].length
        pattern.lastIndex = position
        references.push(reference)
        continue
      }
    }
    if (INLINE_TAGS.has(tag)) line += match[0]
    if (!BLOCK_TAGS.has(tag)) continue

    endLine()
    if (LIST_TAGS.has(tag)) {
      if (closing) closeThrough('ul')
      else openList()
    } else if (tag === 'li') {
      const listAt = stack.findLastIndex(frame => frame.kind === 'ul')
      const list = stack[listAt]
      if (closing) {
        // Only the entry still open in the innermost list is closed.
        if (stack.findLastIndex(frame => frame.kind === 'li') > listAt) closeThrough('li')
      } else if (list?.kind === 'ul') {
        // An entry ends the previous one of its list.
        stack.length = listAt + 1
        openEntry('li', list.list)
      } else {
        // Outside any list it starts one.
        stack.length = 1
        openEntry('li', openList())
      }
    } else if (tag === 'p' && !stack.some(frame => frame.kind === 'ul')) {
      // Outside lists a paragraph is an entry, and one opened inside another is its
      // sub-entry. Within a list it only separates lines.
      if (closing) closeThrough('p')
      else {
        const blocks = currentEntry().blocks
        const siblings = blocks.at(-1)
        if (Array.isArray(siblings)) openEntry('p', siblings)
        else {
          const list: NaveEntry[] = []
          blocks.push(list)
          openEntry('p', list)
        }
      }
    }
  }
  line += html.slice(position)
  endLine()

  return { blocks: tidyBlocks(root.blocks), references }
}

/** Drops empty entries, lifts the ones that only wrap lists and merges adjacent lists. */
const tidyBlocks = (blocks: NaveBlock[]): NaveBlock[] => {
  const tidy: NaveBlock[] = []
  for (const block of blocks) {
    if (typeof block === 'string') {
      tidy.push(block)
      continue
    }
    const entries = block.flatMap(entry => {
      const inner = tidyBlocks(entry.blocks)
      const lists = inner.filter((part): part is NaveEntry[] => Array.isArray(part))
      return lists.length === inner.length ? lists.flat() : [{ blocks: inner }]
    })
    if (!entries.length) continue
    const previous = tidy.at(-1)
    if (Array.isArray(previous)) previous.push(...entries)
    else tidy.push(entries)
  }
  return tidy
}

// The first line of an entry names a sub-topic when references or sub-entries follow it.
const headingOf = (blocks: NaveBlock[]): string | undefined => {
  const first = blocks[0]
  return blocks.length > 1 && typeof first === 'string' && !/<a\b/iu.test(first) ? first : undefined
}

const renderBlocks = (blocks: NaveBlock[], inEntry: boolean): string =>
  blocks
    .map((block, index) => {
      if (typeof block !== 'string') {
        return `<ul>${block.map(entry => `<li>${renderBlocks(entry.blocks, true)}</li>`).join('')}</ul>`
      }
      return inEntry && index === 0 && headingOf(blocks) ? `<b>${block}</b>` : `<p>${block}</p>`
    })
    .join('')

/**
 * Renders the description of a topic: one well-formed outline whatever the dialect, each
 * Bible reference linked to its passage and each cross-reference to its topic page. A link
 * that resolves to no site page is dropped and its text kept.
 */
export const renderNaveDescription = (html: string, context: NaveLinkContext): NaveDescription => {
  const { blocks, references } = parseNaveOutline(html, context.language)
  const entries = blocks.flatMap(block => (typeof block === 'string' ? [] : block))
  return {
    html: sanitizeEditorialHtml(renderBlocks(blocks, false), {
      resolveHref: href => resolveNaveHref(href, context),
    }),
    headings: entries.flatMap(entry => {
      const heading = headingOf(entry.blocks)
      return heading ? [editorialHtmlToText(heading)] : []
    }),
    referenceCount: references.length,
    references,
  }
}
