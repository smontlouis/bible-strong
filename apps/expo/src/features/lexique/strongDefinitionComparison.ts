import { DomUtils, parseDocument } from 'htmlparser2'
import { hasChildren, isTag, isText, type ChildNode } from 'domhandler'
import { removeLegacySpacerImages } from '~common/stylizedHtmlUtils'

const BLOCK = /^(?:br|p|div|li|ul|ol|h[1-6]|tr|section)$/u

// Preserve diacritics and lexical text; similarity is a reading-level heuristic,
// not a claim that two definitions have exactly the same meaning.
const normalizeText = (text: string) =>
  text
    .normalize('NFC')
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/\s+/gu, ' ')
    .replace(/\s*([,;:!?()])\s*/gu, '$1')
    .trim()
    .replace(/[.;]$/u, '')

export const describeStrongDefinition = (html: string | undefined, gloss = '') => {
  const document = parseDocument(removeLegacySpacerImages(html ?? ''))
  const links: string[] = []
  const media: string[] = []
  const visit = (node: ChildNode): string => {
    if (isText(node)) return node.data
    if (!hasChildren(node)) return ''
    if (isTag(node)) {
      if (node.attribs.href) links.push(node.attribs.href)
      if (/^(?:img|video|audio|iframe|svg)$/u.test(node.name)) {
        media.push(DomUtils.getOuterHTML(node))
      }
    }
    const text = node.children.map(visit).join('')
    return isTag(node) && BLOCK.test(node.name) ? `\n${text}\n` : text
  }
  const lines = document.children
    .map(visit)
    .join('')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  // STEP often repeats the already visible gloss before its actual definition.
  if (
    lines.length > 1 &&
    lines[0].startsWith(':') &&
    normalizeText(lines[0].slice(1)) === normalizeText(gloss)
  ) {
    lines.shift()
  }
  let text = normalizeText(lines.join(' '))
  // A sole "1)" is presentation, but do not erase a numbered sense hierarchy.
  if (/^1\)/u.test(text) && !/\s(?:\d+[a-z]?\d*|[a-z])\)/u.test(text)) {
    text = text.slice(2).trim()
  }
  return { text, references: JSON.stringify({ links, media }) }
}

export type StrongDefinitionComparison = {
  redundant: boolean
  similarity: number | null
  simpleWords: number
  detailedWords: number
  reason:
    | 'empty'
    | 'references'
    | 'identical'
    | 'additional-content'
    | 'budget'
    | 'similar'
    | 'different'
}

const words = (text: string) =>
  text
    .replace(/\b\d+(?:[a-z]\d*)*\)/giu, ' ')
    .toLowerCase()
    .match(/[\p{L}\p{M}\p{N}]+/gu) ?? []

export const countStrongDefinitionWords = (html: string | undefined, gloss = '') =>
  words(describeStrongDefinition(html, gloss).text).length

// Bound both CPU and retained memory. Long/unusual entries remain visible.
const MAX_CELLS = 250_000
const MAX_HTML_LENGTH = 32_000
const cache = new Map<string, StrongDefinitionComparison>()

export const compareStrongDefinitions = ({
  simpleHtml = '',
  detailedHtml = '',
  gloss,
}: {
  simpleHtml?: string
  detailedHtml?: string
  gloss: string
  stepCode?: string
}): StrongDefinitionComparison => {
  const result = (
    reason: StrongDefinitionComparison['reason'],
    similarity: number | null = null,
    simpleWords = 0,
    detailedWords = 0
  ): StrongDefinitionComparison => ({
    redundant: reason === 'identical' || reason === 'similar',
    similarity,
    simpleWords,
    detailedWords,
    reason,
  })
  if (!simpleHtml.trim() || !detailedHtml.trim()) return result('empty')
  if (simpleHtml.length + detailedHtml.length > MAX_HTML_LENGTH) return result('budget')
  const key = JSON.stringify([simpleHtml, detailedHtml, gloss])
  const previous = cache.get(key)
  if (previous) return previous
  const simple = describeStrongDefinition(simpleHtml, gloss)
  const detailed = describeStrongDefinition(detailedHtml, gloss)
  const a = words(simple.text)
  const b = words(detailed.text)
  let comparison: StrongDefinitionComparison
  if (!a.length || !b.length) comparison = result('empty')
  else if (simple.references !== detailed.references)
    comparison = result('references', null, a.length, b.length)
  else if (simple.text === detailed.text) comparison = result('identical', 1, a.length, b.length)
  else if (b.length > a.length * 1.2)
    comparison = result('additional-content', null, a.length, b.length)
  else if (a.length * b.length > MAX_CELLS) comparison = result('budget', null, a.length, b.length)
  else {
    // Longest common subsequence: repetitions count, and word order matters.
    // Dice similarity = 2 * shared words / total words in both definitions.
    const row = new Uint32Array(b.length + 1)
    for (const left of a) {
      let diagonal = 0
      for (let j = 1; j <= b.length; j++) {
        const above = row[j]
        row[j] = left === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1])
        diagonal = above
      }
    }
    const similarity = (2 * row[b.length]) / (a.length + b.length)
    comparison = result(similarity >= 0.7 ? 'similar' : 'different', similarity, a.length, b.length)
  }
  if (cache.size >= 32) cache.delete(cache.keys().next().value!)
  cache.set(key, comparison)
  return comparison
}

export const isRedundantStrongDefinition = (
  input: Parameters<typeof compareStrongDefinitions>[0]
): boolean => compareStrongDefinitions(input).redundant
