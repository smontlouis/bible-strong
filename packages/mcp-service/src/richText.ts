import { getSupportedOsisBookNumber } from '@bible-strong/bible-reference-parser/osis-reference'
import { Parser } from 'htmlparser2'
import type { Block, Inline } from './cards/types'

/**
 * Editorial HTML comes from many sources and is never shown as written: it is read into the
 * few kinds of blocks a card knows how to draw. A tag outside them loses its tag and keeps
 * its text; a link survives only when it names a passage, an entry or a topic.
 */

/** What a link becomes, from its address and attributes. Its text is kept when nothing. */
export type LinkResolver = (
  href: string,
  attributes: Readonly<Record<string, string>>
) => LinkTarget | undefined

export type LinkTarget =
  | { t: 'ref'; osis: string }
  | { t: 'strong'; code: string }
  | { t: 'topic'; name: string }
  | { t: 'entry'; work: string; id: number }

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const PARAGRAPH_BREAKS = new Set(['p', 'div', 'tr', 'dt', 'dd', 'table', 'section', 'article'])
const BOLD = new Set(['b', 'strong'])
const ITALIC = new Set(['i', 'em', 'cite'])
const IGNORED = new Set(['script', 'style', 'head'])

type ListFrame = { ordered: boolean; items: Block[][]; itemOpen: boolean }

export const htmlToBlocks = (html: string, resolveLink?: LinkResolver): Block[] => {
  const root: Block[] = []
  // Where finished blocks go: the document, or the entry of a list being read.
  const targets: Block[][] = [root]
  const lists: ListFrame[] = []
  let inline: Inline[] = []
  let kind: 'p' | 'h' | 'quote' = 'p'
  let bold = 0
  let italic = 0
  let superscript = 0
  let ignored = 0
  let quoteDepth = 0
  let link: { target: LinkTarget; text: string } | undefined

  const target = () => targets[targets.length - 1] as Block[]

  const flush = () => {
    // A line break opens or closes nothing.
    while (inline[0]?.t === 'br') inline.shift()
    while (inline.at(-1)?.t === 'br') inline.pop()
    const first = inline[0]
    if (first?.t === 'text') first.text = first.text.trimStart()
    const last = inline.at(-1)
    if (last?.t === 'text') last.text = last.text.trimEnd()
    const content = inline.filter(node => node.t !== 'text' || node.text)
    if (content.length) target().push({ t: kind, c: content })
    inline = []
    kind = quoteDepth ? 'quote' : 'p'
  }

  const pushText = (text: string) => {
    const collapsed = text.replace(/\s+/gu, ' ')
    if (!collapsed) return
    if (link) {
      link.text += collapsed
      return
    }
    const previous = inline.at(-1)
    // Nothing starts with a space, and two spaces read as one.
    if (collapsed === ' ' && (!previous || previous.t === 'br')) return
    const marks = {
      ...(bold ? { b: true as const } : {}),
      ...(italic ? { i: true as const } : {}),
      ...(superscript ? { sup: true as const } : {}),
    }
    if (
      previous?.t === 'text' &&
      Boolean(previous.b) === Boolean(bold) &&
      Boolean(previous.i) === Boolean(italic) &&
      Boolean(previous.sup) === Boolean(superscript)
    ) {
      previous.text = `${previous.text}${collapsed}`.replace(/ {2,}/gu, ' ')
      return
    }
    inline.push({ t: 'text', text: collapsed, ...marks })
  }

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (IGNORED.has(name)) ignored += 1
        if (ignored) return
        if (BOLD.has(name)) bold += 1
        else if (ITALIC.has(name)) italic += 1
        else if (name === 'sup') superscript += 1
        else if (name === 'br') {
          if (!link && inline.length && inline.at(-1)?.t !== 'br') inline.push({ t: 'br' })
        } else if (name === 'hr') {
          flush()
          target().push({ t: 'rule' })
        } else if (name === 'a') {
          const resolved = attributes.href ? resolveLink?.(attributes.href, attributes) : undefined
          if (resolved) link = { target: resolved, text: '' }
        } else if (HEADINGS.has(name)) {
          flush()
          kind = 'h'
        } else if (name === 'blockquote') {
          flush()
          quoteDepth += 1
          kind = 'quote'
        } else if (name === 'ul' || name === 'ol') {
          flush()
          lists.push({ ordered: name === 'ol', items: [], itemOpen: false })
        } else if (name === 'li') {
          flush()
          const list = lists.at(-1)
          // Outside a list an entry is a paragraph like another.
          if (!list) return
          // An entry left open is ended by the next one.
          if (list.itemOpen) targets.pop()
          const item: Block[] = []
          list.items.push(item)
          targets.push(item)
          list.itemOpen = true
        } else if (PARAGRAPH_BREAKS.has(name)) {
          flush()
        } else if (name === 'td' || name === 'th') {
          pushText(' ')
        }
      },
      ontext(text) {
        if (!ignored) pushText(text)
      },
      onclosetag(name) {
        if (IGNORED.has(name)) {
          ignored = Math.max(0, ignored - 1)
          return
        }
        if (ignored) return
        if (BOLD.has(name)) bold = Math.max(0, bold - 1)
        else if (ITALIC.has(name)) italic = Math.max(0, italic - 1)
        else if (name === 'sup') superscript = Math.max(0, superscript - 1)
        else if (name === 'a') {
          if (!link) return
          const { target: resolved, text } = link
          link = undefined
          const label = text.trim()
          if (!label) return
          if (text.startsWith(' ')) pushText(' ')
          inline.push({ ...resolved, text: label } as Inline)
          if (text.endsWith(' ')) pushText(' ')
        } else if (HEADINGS.has(name)) {
          flush()
        } else if (name === 'blockquote') {
          flush()
          quoteDepth = Math.max(0, quoteDepth - 1)
          kind = quoteDepth ? 'quote' : 'p'
        } else if (name === 'ul' || name === 'ol') {
          flush()
          const list = lists.pop()
          if (!list) return
          // The entry the list left open ends with it.
          if (list.itemOpen) targets.pop()
          const items = list.items.filter(item => item.length)
          if (items.length) {
            target().push({ t: 'list', ...(list.ordered ? { ordered: true as const } : {}), items })
          }
        } else if (name === 'li') {
          flush()
          const list = lists.at(-1)
          if (list?.itemOpen) {
            targets.pop()
            list.itemOpen = false
          }
        } else if (PARAGRAPH_BREAKS.has(name)) {
          flush()
        }
      },
    },
    { decodeEntities: true }
  )
  parser.write(html)
  parser.end()
  flush()
  return root
}

// --- Links ---------------------------------------------------------------------

const OSIS_POINT = /^([1-3]?[A-Za-z]+)\.\d+(?:\.\d+)?$/u

/** `Exod.4.14-Exod.4.16`, `Rev.1.8,Rev.1.11`, `Lev.8`: kept when every book is one we read. */
const osisTarget = (value: string): string | undefined => {
  const segments = value.split(',').filter(Boolean)
  const known = segments.every(segment =>
    segment.split('-').every(point => {
      const match = OSIS_POINT.exec(point)
      return match ? Boolean(getSupportedOsisBookNumber(match[1]!)) : /^\d+$/u.test(point)
    })
  )
  return segments.length && known ? segments.join(',') : undefined
}

/** The links of dictionaries and commentaries: a passage, a Strong entry, another article. */
export const editorialLinks =
  (work?: string): LinkResolver =>
  (href, attributes) => {
    if (href.startsWith('bible://')) {
      const osis = osisTarget(href.slice('bible://'.length))
      return osis ? { t: 'ref', osis } : undefined
    }
    if (href.startsWith('strong://')) {
      const code = href.slice('strong://'.length)
      return /^[HG]\d+[A-Za-z]*$/u.test(code) ? { t: 'strong', code } : undefined
    }
    // An article names another by its identity in the same dictionary, never by an address.
    const entryId = Number(attributes['data-entry-id'])
    if (work && Number.isInteger(entryId) && entryId > 0) return { t: 'entry', work, id: entryId }
    return undefined
  }

/** Where passages are written in a text: `findReferences`, in the language of a card. */
export type ReferenceFinder = (
  text: string
) => readonly { start: number; end: number; osis: string; label: string }[]

const linkWritten = (nodes: readonly Inline[], find: ReferenceFinder): Inline[] =>
  nodes.flatMap((node): Inline[] => {
    // A raised number is a verse number or a note mark, never a reference.
    if (node.t !== 'text' || node.sup) return [node]
    const found = find(node.text)
    if (!found.length) return [node]
    const parts: Inline[] = []
    let at = 0
    for (const { start, end, osis, label } of found) {
      if (start > at) parts.push({ ...node, text: node.text.slice(at, start) })
      const text = node.text.slice(start, end)
      parts.push({ t: 'ref', text, osis, ...(label === text ? {} : { label }) })
      at = end
    }
    if (at < node.text.length) parts.push({ ...node, text: node.text.slice(at) })
    return parts
  })

/**
 * Makes a link of each passage a text writes without linking it (« voir Ge 14:18 »). The
 * links a resource already bears are kept as they are.
 */
export const withReferences = (blocks: readonly Block[], find: ReferenceFinder): Block[] =>
  blocks.map((block): Block => {
    if (block.t === 'rule') return block
    if (block.t === 'list') {
      return { ...block, items: block.items.map(item => withReferences(item, find)) }
    }
    return { ...block, c: linkWritten(block.c, find) }
  })

// --- Plain text ----------------------------------------------------------------

const inlineText = (nodes: readonly Inline[]): string =>
  nodes
    .map(node => (node.t === 'br' ? '\n' : node.text))
    .join('')
    .replace(/[ \t]+\n/gu, '\n')
    .trim()

const blockLines = (blocks: readonly Block[]): string[] =>
  blocks.flatMap(block => {
    if (block.t === 'rule') return ['—']
    if (block.t !== 'list') return [inlineText(block.c)]
    return block.items.map((item, index) => {
      // What an entry holds after its first line is set under it.
      const [first = '', ...rest] = blockLines(item).filter(Boolean).join('\n').split('\n')
      const bullet = block.ordered ? `${index + 1}.` : '-'
      return [`${bullet} ${first}`, ...rest.map(line => `  ${line}`)].join('\n')
    })
  })

/** What the model reads of rich text: its words, its lists and nothing of its markup. */
export const blocksToText = (blocks: readonly Block[]): string =>
  blockLines(blocks).filter(Boolean).join('\n\n')

/** Cuts a text at the end of a word, and says so. */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export const htmlToText = (html: string): string => blocksToText(htmlToBlocks(html))
