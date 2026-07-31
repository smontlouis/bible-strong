import { getLanguage } from '~i18n'
import {
  parseInlineBibleReferences,
  type BcvLanguage,
  type InlineBibleReference,
} from '~helpers/bcvParser'
import { formatStrongOsisReference } from './strongReferenceNavigation'

const HTML_TOKEN_PATTERN = /<!--[\\s\\S]*?-->|<[^>]*>/gu
const LEGACY_REFERENCE_TAG_PATTERN = /^(?:<ref=(?:"[^"]*"|'[^']*')>|<\/ref\s*>)$/iu
const ESCAPED_LEGACY_REFERENCE_TAG_PATTERN =
  /&lt;(?:ref=(?:&quot;[\s\S]*?&quot;|&#34;[\s\S]*?&#34;|&apos;[\s\S]*?&apos;|&#39;[\s\S]*?&#39;|"[^"]*"|'[^']*')|\/ref\s*)&gt;/giu
const LEGACY_BLOCK_TAG_PATTERN = /^<(\/?)(?:level[1-4]|re)>$/iu
const LEGACY_INLINE_TAG_PATTERN = /^<(\/?)(?:note|date|author|def|corr)>$/iu
const LEGACY_LINE_BREAK_TAG_PATTERN = /^<lb\s*\/?>$/iu
const LEGACY_STRONG_CODE_TAG_PATTERN = /^<([HG]\d+[A-Z]?)>$/u
const LEGACY_EMPHASIS_TAG_PATTERN = /^<(?:strong|s\s+trong)="[HG]\d+[A-Z]?">$/iu

const normalizeLegacyEditorialHtml = (html: string): string => {
  const normalizedInput = html.replace(ESCAPED_LEGACY_REFERENCE_TAG_PATTERN, '')
  let cursor = 0
  let result = ''

  for (const match of normalizedInput.matchAll(HTML_TOKEN_PATTERN)) {
    const index = match.index ?? 0
    const token = match[0]
    result += normalizedInput.slice(cursor, index)
    const blockTag = token.match(LEGACY_BLOCK_TAG_PATTERN)
    const inlineTag = token.match(LEGACY_INLINE_TAG_PATTERN)
    const strongCodeTag = token.match(LEGACY_STRONG_CODE_TAG_PATTERN)
    if (blockTag) {
      result += `<${blockTag[1]}div>`
    } else if (inlineTag) {
      result += `<${inlineTag[1]}span>`
    } else if (LEGACY_LINE_BREAK_TAG_PATTERN.test(token)) {
      result += '<br />'
    } else if (strongCodeTag) {
      result += strongCodeTag[1].toUpperCase()
    } else if (LEGACY_EMPHASIS_TAG_PATTERN.test(token)) {
      result += '<strong>'
    } else if (!LEGACY_REFERENCE_TAG_PATTERN.test(token)) {
      result += token
    }
    cursor = index + token.length
  }

  return result + normalizedInput.slice(cursor)
}

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
  const normalizedHtml = normalizeLegacyEditorialHtml(html)
  let anchorDepth = 0
  let cursor = 0
  let result = ''

  for (const match of normalizedHtml.matchAll(HTML_TOKEN_PATTERN)) {
    const index = match.index ?? 0
    const text = normalizedHtml.slice(cursor, index)
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

  const remaining = normalizedHtml.slice(cursor)
  return result + (anchorDepth > 0 ? remaining : linkifyText(remaining, linkColor))
}
