import { bookNumber, sha256 } from './wave-sources.mjs'

export const EGW_COMMENTARY_VOLUMES = Array.from({ length: 7 }, (_, index) => ({
  bookId: 90 + index,
  code: `${index + 1}BC`,
  volume: index + 1,
}))

export const EGW_SCRIPTURE_INDEX = { bookId: 14275, code: 'ECSI' }

const decodeEntities = value => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&mdash;/gi, '—')
  .replace(/&ndash;/gi, '–')
  .replace(/&hellip;/gi, '…')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

export const plainText = value => decodeEntities(String(value ?? ''))
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const normalizeEgwMarkup = value => decodeEntities(String(value ?? ''))
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(?:script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|svg)>/gi, '')
  .replace(/<span\b[^>]*class="[^"]*refCode[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
  .replace(/<span\b[^>]*class="[^"]*egwlink_bible[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<span class="ref">$1</span>')
  .replace(/<span\b[^>]*class="[^"]*egwlink_book[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<span class="source-ref">$1</span>')
  .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
  .replace(/<(?:b|strong)\b[^>]*>/gi, '<strong>').replace(/<\/(?:b|strong)>/gi, '</strong>')
  .replace(/<(?:i|em)\b[^>]*>/gi, '<em>').replace(/<\/(?:i|em)>/gi, '</em>')
  .replace(/<br\b[^>]*>/gi, '<br>')
  .replace(/<p\b[^>]*>/gi, '<p>').replace(/<\/p>/gi, '</p>')
  .replace(/<span\b([^>]*)>/gi, (_, attributes) => {
    const safeClass = attributes.match(/\bclass="(ref|source-ref)"/i)?.[1]?.toLowerCase()
    return safeClass ? '<span class="' + safeClass + '">' : '<span>'
  })
  .replace(/<\/span>/gi, '</span>')
  .replace(/<(?!\/?(?:p|br|strong|em|span)\b)[^>]+>/gi, '')
  .replace(/\s+/g, ' ')
  .replace(/>\s+</g, '><')
  .trim()

const normalizeBookName = value => plainText(value)
  .replace(/^(\d)([A-Za-z])/, '$1 $2')
  .replace(/^Psalms?$/i, 'Psalms')
  .replace(/^Canticles$/i, 'Song of Songs')

const parseAnchor = ({ bookName, chapter, verseExpression }) => {
  const verse = Number(String(verseExpression).match(/\d+/)?.[0])
  if (!Number.isInteger(verse) || verse < 1) throw new Error(`Expression de verset EGW non reconnue : ${verseExpression}`)
  return {
    passage: `${bookNumber(normalizeBookName(bookName))}-${Number(chapter)}-${verse}`,
    passageEndVerse: Number(String(verseExpression).match(/\d+\s*[-–—]\s*(\d+)/)?.[1]) || verse,
  }
}

export const parseCommentaryToc = ({ html, bookId, code }) => {
  const pages = []
  let currentBook = null
  for (const match of String(html).matchAll(/<a\b[^>]*href="\/read\/([\d.]+)"[^>]*class="([^"]*book-toc__link[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, pageId, classes, labelHtml] = match
    const label = plainText(labelHtml)
    if (classes.includes('js-toc_e')) {
      try {
        currentBook = normalizeBookName(label)
        bookNumber(currentBook)
      } catch {
        currentBook = null
      }
      continue
    }
    const chapter = Number(label.match(/(?:Chapter|Psalm)\s+(\d+)/i)?.[1])
    if (currentBook && Number.isInteger(chapter)) pages.push({ bookId, code, pageId, bookName: currentBook, chapter })
  }
  return [...new Map(pages.map(page => [page.pageId, page])).values()]
}

export const parseScriptureIndexToc = html => {
  const pages = []
  for (const match of String(html).matchAll(/<a\b[^>]*href="\/read\/([\d.]+)"[^>]*class="([^"]*book-toc__link[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (match[2].includes('js-toc_e')) continue
    const label = plainText(match[3])
    const parsed = label.match(/^(.+?)\s+(\d+)$/)
    if (!parsed) continue
    const bookName = normalizeBookName(parsed[1])
    try {
      bookNumber(bookName)
    } catch {
      continue
    }
    pages.push({ bookId: EGW_SCRIPTURE_INDEX.bookId, code: EGW_SCRIPTURE_INDEX.code, pageId: match[1], bookName, chapter: Number(parsed[2]) })
  }
  return [...new Map(pages.map(page => [page.pageId, page])).values()]
}

const paragraphMatches = html => [...String(html).matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)].map(match => ({
  attributes: match[1],
  inner: match[2],
  id: match[1].match(/\bid="([^"]+)"/i)?.[1] ?? null,
  classes: match[1].match(/\bclass="([^"]+)"/i)?.[1] ?? '',
}))

export const parseCommentaryPage = ({ html, page }) => {
  const entries = []
  for (const paragraph of paragraphMatches(html)) {
    if (!paragraph.classes.split(/\s+/).includes('para')) continue
    const primary = paragraph.inner.match(/<span\b[^>]*class="[^"]*egwlink_bible[^"]*"[^>]*title="([^"]+)"[^>]*>/i)
    const reference = decodeEntities(primary?.[1] ?? `${page.bookName} ${page.chapter}:1`)
    const parsedReference = reference.match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–—]\s*(\d+))?$/)
    const anchor = parsedReference
      ? parseAnchor({ bookName: parsedReference[1], chapter: parsedReference[2], verseExpression: parsedReference[4] ? `${parsedReference[3]}-${parsedReference[4]}` : parsedReference[3] })
      : parseAnchor({ bookName: page.bookName, chapter: page.chapter, verseExpression: 1 })
    const htmlBody = normalizeEgwMarkup(paragraph.inner)
    if (!plainText(htmlBody)) continue
    const sourceLinks = [...paragraph.inner.matchAll(/<span\b[^>]*class="[^"]*egwlink_book[^"]*"[^>]*title="([^"]+)"[^>]*data-link="([^"]+)"[^>]*>/gi)]
      .map(match => ({ label: decodeEntities(match[1]), paragraphId: match[2], url: `https://text.egwwritings.org/read/${match[2]}` }))
    entries.push({
      schemaVersion: 1,
      id: `egw-${page.code.toLowerCase()}:${paragraph.id ?? sha256(htmlBody).slice(0, 16)}`,
      ...anchor,
      referenceLabel: reference,
      resource: { id: `egw-${page.code.toLowerCase()}`, name: `EGW SDA Bible Commentary ${page.code}`, author: 'Ellen G. White', sourceLanguage: 'en', license: 'CustomPermission' },
      source: { language: 'en', html: htmlBody, sha256: sha256(htmlBody), provenance: `EGW Writings · ${page.code} · ${paragraph.id}`, url: `https://text.egwwritings.org/read/${paragraph.id}` },
      translation: null,
      editorialKind: 'curated-commentary',
      originalSources: sourceLinks,
    })
  }
  return entries
}

export const parseScriptureIndexPage = ({ html, page }) => {
  const paragraphs = paragraphMatches(html)
  const entries = []
  let verseExpression = null
  for (const paragraph of paragraphs) {
    if (paragraph.classes.split(/\s+/).includes('h4')) {
      verseExpression = plainText(paragraph.inner)
      continue
    }
    if (!verseExpression || !paragraph.classes.split(/\s+/).includes('para')) continue
    const citations = [...paragraph.inner.matchAll(/<span\b[^>]*class="[^"]*egwlink_book[^"]*"[^>]*title="([^"]+)"[^>]*data-link="([^"]+)"[^>]*>/gi)]
      .map(match => ({ label: decodeEntities(match[1]), paragraphId: match[2], url: `https://text.egwwritings.org/read/${match[2]}` }))
    const uniqueCitations = [...new Map(citations.map(citation => [citation.paragraphId, citation])).values()]
    if (uniqueCitations.length === 0) continue
    entries.push({
      schemaVersion: 1,
      id: `egw-ecsi:${paragraph.id ?? sha256(`${page.pageId}:${verseExpression}`).slice(0, 16)}`,
      ...parseAnchor({ bookName: page.bookName, chapter: page.chapter, verseExpression }),
      referenceLabel: `${page.bookName} ${page.chapter}:${verseExpression}`,
      verseExpression,
      indexParagraphId: paragraph.id,
      citations: uniqueCitations,
      sourceUrl: `https://text.egwwritings.org/read/${paragraph.id}`,
    })
  }
  return entries
}

export const mergeEgwLayers = ({ commentary, scriptureIndex }) => {
  const merged = new Map()
  const ensure = passage => {
    if (!merged.has(passage)) merged.set(passage, { passage, curatedCommentary: [], scriptureIndex: [] })
    return merged.get(passage)
  }
  for (const entry of commentary) ensure(entry.passage).curatedCommentary.push(entry)
  for (const entry of scriptureIndex) ensure(entry.passage).scriptureIndex.push(entry)
  return [...merged.values()].sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }))
}
