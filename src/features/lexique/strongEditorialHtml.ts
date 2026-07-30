import { getLanguage } from '~i18n'
import {
  parseInlineBibleReferences,
  type BcvLanguage,
  type InlineBibleReference,
} from '~helpers/bcvParser'
import { formatStrongOsisReference } from './strongReferenceNavigation'

const HTML_TOKEN_PATTERN = /<!--[\\s\\S]*?-->|<[^>]*>/gu

const escapeHtmlText = (value: string): string =>
  value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')

const referencesOverlap = (first: InlineBibleReference, second: InlineBibleReference): boolean =>
  first.start < second.end && second.start < first.end

const parseStrongEditorialBibleReferences = (text: string): InlineBibleReference[] => {
  const preferredLanguage: BcvLanguage = getLanguage() === 'en' ? 'en' : 'fr'
  const alternateLanguage: BcvLanguage = preferredLanguage === 'fr' ? 'en' : 'fr'
  const references: InlineBibleReference[] = []
  const candidates = [
    ...parseInlineBibleReferences(text, preferredLanguage).map(reference => ({
      reference,
      languagePriority: 0,
    })),
    ...parseInlineBibleReferences(text, alternateLanguage).map(reference => ({
      reference,
      languagePriority: 1,
    })),
  ].sort(
    (first, second) =>
      second.reference.end -
        second.reference.start -
        (first.reference.end - first.reference.start) ||
      first.languagePriority - second.languagePriority ||
      first.reference.start - second.reference.start
  )

  for (const { reference } of candidates) {
    if (!references.some(current => referencesOverlap(current, reference))) {
      references.push(reference)
    }
  }

  return references.sort((first, second) => first.start - second.start)
}

const linkifyText = (text: string, linkColor?: string): string => {
  const references = parseStrongEditorialBibleReferences(text)
  if (!references.length) return text

  let cursor = 0
  let result = ''
  for (const reference of references) {
    result += text.slice(cursor, reference.start)
    const style = linkColor ? ` style="color: ${linkColor}"` : ''
    const label = escapeHtmlText(formatStrongOsisReference(reference.target.osis))
    result += `<a href="bible://${reference.target.osis}"${style}>${label}</a>`
    cursor = reference.end
  }
  return result + text.slice(cursor)
}

export const linkifyStrongEditorialBibleReferences = (html: string, linkColor?: string): string => {
  let anchorDepth = 0
  let cursor = 0
  let result = ''

  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const index = match.index ?? 0
    const text = html.slice(cursor, index)
    result += anchorDepth > 0 ? text : linkifyText(text, linkColor)

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
  return result + (anchorDepth > 0 ? remaining : linkifyText(remaining, linkColor))
}
