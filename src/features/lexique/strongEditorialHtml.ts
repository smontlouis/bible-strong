import { parseInlineBibleReferences } from '~helpers/bcvParser'

const HTML_TOKEN_PATTERN = /<!--[\\s\\S]*?-->|<[^>]*>/gu

const linkifyText = (text: string): string => {
  const references = parseInlineBibleReferences(text)
  if (!references.length) return text

  let cursor = 0
  let result = ''
  for (const reference of references) {
    result += text.slice(cursor, reference.start)
    result += `<a href="bible://${reference.target.osis}">${text.slice(
      reference.start,
      reference.end
    )}</a>`
    cursor = reference.end
  }
  return result + text.slice(cursor)
}

export const linkifyStrongEditorialBibleReferences = (html: string): string => {
  let anchorDepth = 0
  let cursor = 0
  let result = ''

  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const index = match.index ?? 0
    const text = html.slice(cursor, index)
    result += anchorDepth > 0 ? text : linkifyText(text)

    const token = match[0]
    if (/^<a(?:\s|>)/iu.test(token) && !/\/\s*>$/u.test(token)) {
      anchorDepth += 1
    } else if (/^<\/a\s*>/iu.test(token)) {
      anchorDepth = Math.max(0, anchorDepth - 1)
    }

    result += token
    cursor = index + token.length
  }

  const remaining = html.slice(cursor)
  return result + (anchorDepth > 0 ? remaining : linkifyText(remaining))
}
