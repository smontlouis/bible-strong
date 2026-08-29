import { sha256 } from './firestore.mjs'

const decodeEntities = value =>
  value
    .replace(/&nbsp;|&#xA0;|&#160;/gi, ' ')
    .replace(/&(?:amp|#38);/gi, '&')
    .replace(/&(?:lt|#60);/gi, '<')
    .replace(/&(?:gt|#62);/gi, '>')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))

export const plainText = html =>
  decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())

const normalize = value =>
  plainText(value)
    .normalize('NFKC')
    .toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const frenchMarkers = new Set([
  'ainsi', 'avec', 'avoir', 'cette', 'comme', 'dans', 'des', 'dieu', 'elle', 'est', 'mais',
  'nous', 'par', 'pas', 'pour', 'que', 'qui', 'seigneur', 'son', 'sur', 'une', 'vous',
])
const englishMarkers = new Set([
  'and', 'are', 'as', 'be', 'but', 'by', 'for', 'from', 'god', 'has', 'his', 'in', 'is',
  'lord', 'not', 'of', 'that', 'the', 'their', 'this', 'to', 'was', 'with',
])

export const probableLanguage = html => {
  const words = normalize(html).split(' ').filter(Boolean)
  let french = 0
  let english = 0
  for (const word of words) {
    if (frenchMarkers.has(word)) french += 1
    if (englishMarkers.has(word)) english += 1
  }
  if (french === 0 && english === 0) return 'unknown'
  if (french >= english * 1.35) return 'fr'
  if (english >= french * 1.35) return 'en'
  return 'mixed'
}

const dangerousPatterns = [
  /<\s*script\b/i,
  /<\s*(?:iframe|object|embed|form)\b/i,
  /\son[a-z]+\s*=/i,
  /(?:href|src)\s*=\s*["']?\s*javascript:/i,
  /<\s*style\b/i,
]

export const inspectTranslation = ({ sourceHtml, translationHtml }) => {
  const sourceNormalized = normalize(sourceHtml)
  const translationNormalized = normalize(translationHtml)
  const issues = []

  if (!translationNormalized) issues.push('empty')
  if (translationNormalized && translationNormalized === sourceNormalized) issues.push('identical-to-source')
  const language = probableLanguage(translationHtml)
  if (translationNormalized && language === 'en') issues.push('probably-english')
  if (translationNormalized && language === 'mixed') issues.push('mixed-language')
  if (dangerousPatterns.some(pattern => pattern.test(translationHtml))) issues.push('dangerous-html')
  if ((translationHtml.match(/</g) ?? []).length !== (translationHtml.match(/>/g) ?? []).length) {
    issues.push('malformed-angle-brackets')
  }

  return {
    issues,
    probableLanguage: language,
    sourceCharacters: sourceHtml.length,
    translationCharacters: translationHtml.length,
    sourceSha256: sha256(sourceHtml),
    translationSha256: translationHtml ? sha256(translationHtml) : null,
  }
}
