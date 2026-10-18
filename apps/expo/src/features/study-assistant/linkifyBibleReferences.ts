import { parseInlineBibleReferencesInAnyLanguage } from '~helpers/bcvParser'

export const PASSAGE_LINK_PREFIX = 'https://bible-strong.app/assistant-passage/'

// Fenced code, inline code, existing links, bare URLs and a link still being streamed.
const protectedSpans =
  /```[\s\S]*?(?:```|$)|`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\)|https?:\/\/\S+|\[[^\]\n]*$/g

const linkify = (text: string) => {
  const references = parseInlineBibleReferencesInAnyLanguage(text)
  if (!references.length) return text
  let output = ''
  let cursor = 0
  for (const reference of references) {
    output += text.slice(cursor, reference.start)
    output += `[${reference.text}](${PASSAGE_LINK_PREFIX}${encodeURIComponent(reference.target.osis)})`
    cursor = reference.end
  }
  return output + text.slice(cursor)
}

/**
 * The native renderer takes Markdown text, not a syntax tree: Bible references become
 * links in the source itself, leaving code and existing links untouched.
 */
export function linkifyBibleReferences(markdown: string) {
  let output = ''
  let cursor = 0
  for (const match of markdown.matchAll(protectedSpans)) {
    output += linkify(markdown.slice(cursor, match.index)) + match[0]
    cursor = match.index + match[0].length
  }
  return output + linkify(markdown.slice(cursor))
}

export function passageOsisFromLink(url: string) {
  if (!url.startsWith(PASSAGE_LINK_PREFIX)) return undefined
  try {
    return decodeURIComponent(url.slice(PASSAGE_LINK_PREFIX.length))
  } catch {
    return undefined
  }
}
