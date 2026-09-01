import { bookNumber, sha256 } from './wave-sources.mjs'
import { normalizeCommentaryContent } from './commentary-links.mjs'
import { bcv_parser } from '../../../../../packages/bible-reference-parser/esm/bcv_parser.js'
import * as en from '../../../../../packages/bible-reference-parser/esm/lang/en.js'

export const EGW_COMMENTARY_VOLUMES = Array.from({ length: 7 }, (_, index) => ({
  bookId: 90 + index,
  code: `${index + 1}BC`,
  volume: index + 1,
}))

export const EGW_SCRIPTURE_INDEX = { bookId: 14275, code: 'ECSI' }

const scriptureScopeParser = new bcv_parser(en)
scriptureScopeParser.set_options({
  book_match_strategy: 'strict',
  consecutive_combination_strategy: 'separate',
  sequence_combination_strategy: 'separate',
  testaments: 'ona',
})

const OSIS_BOOK_NUMBERS = new Map([
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs',
  '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song',
  'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah',
  'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom',
  '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus',
  'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev',
].map((osis, index) => [osis, index + 1]))

const detachString = value => Buffer.from(String(value ?? ''), 'utf8').toString('utf8')

const decodeEntities = value => detachString(String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&mdash;/gi, '—')
  .replace(/&ndash;/gi, '–')
  .replace(/&hellip;/gi, '…')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16))))

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

const attribute = (attributes, name) => String(attributes).match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] ?? null

export const isChapterAssociationMarker = value => /^This chapter is based on\b/i.test(plainText(value))

export const parseChapterAssociationScriptureScope = value => {
  const label = plainText(value)
    .replace(/^This chapter is based on\s*/i, '')
    .replace(/\s*\.\s*$/u, '')
    .trim()
  const osis = scriptureScopeParser.parse(label).osis()
  return label && osis ? { label, osis } : null
}

const osisLocation = value => {
  const match = String(value).match(/^([1-4]?[A-Za-z]+)(?:\.(\d+))?(?:\.(\d+))?$/u)
  if (!match || !OSIS_BOOK_NUMBERS.has(match[1])) return null
  return {
    book: OSIS_BOOK_NUMBERS.get(match[1]),
    chapter: Number(match[2] ?? 0),
    verse: Number(match[3] ?? 0),
  }
}

const compareLocation = (left, right) =>
  left.book - right.book || left.chapter - right.chapter || left.verse - right.verse

export const scriptureScopeCoversPassage = (osis, passage) => {
  const currentMatch = String(passage).match(/^(\d+)-(\d+)-(\d+)$/u)
  if (!currentMatch) return false
  const current = {
    book: Number(currentMatch[1]),
    chapter: Number(currentMatch[2]),
    verse: Number(currentMatch[3]),
  }
  return String(osis).split(',').some(segment => {
    const [startValue, endValue] = segment.split('-')
    const start = osisLocation(startValue)
    if (!start) return false
    if (!endValue) {
      if (start.book !== current.book) return false
      if (!start.chapter) return true
      if (start.chapter !== current.chapter) return false
      return !start.verse || start.verse === current.verse
    }
    const parsedEnd = osisLocation(endValue)
    if (!parsedEnd) return false
    const end = {
      ...parsedEnd,
      chapter: parsedEnd.chapter || Number.MAX_SAFE_INTEGER,
      verse: parsedEnd.verse || Number.MAX_SAFE_INTEGER,
    }
    const normalizedStart = {
      ...start,
      chapter: start.chapter || 0,
      verse: start.verse || 0,
    }
    return compareLocation(current, normalizedStart) >= 0 && compareLocation(current, end) <= 0
  })
}

export const parseBookTocSectionPages = ({ html, sectionPageId }) => {
  const anchors = [...String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map(match => ({
      pageId: attribute(match[1], 'href')?.match(/^\/read\/([\d.]+)$/)?.[1] ?? null,
      classes: attribute(match[1], 'class') ?? '',
      end: match.index + match[0].length,
    }))
    .filter(anchor => anchor.pageId && anchor.classes.split(/\s+/).includes('book-toc__link'))
  const section = anchors.find(anchor => anchor.pageId === sectionPageId)
  if (!section) throw new Error(`Section EGW absente de la table des matières : ${sectionPageId}`)
  if (!section.classes.split(/\s+/).includes('js-toc_e')) return [sectionPageId]
  const sublist = String(html).slice(section.end).match(/^\s*<ul\b[^>]*class="[^"]*book-toc__sublist[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1]
  if (!sublist) return [sectionPageId]
  const childPageIds = [...sublist.matchAll(/<a\b([^>]*)>/gi)]
    .map(match => attribute(match[1], 'href')?.match(/^\/read\/([\d.]+)$/)?.[1])
    .filter(Boolean)
  return [sectionPageId, ...childPageIds]
}

const metaContent = (html, selector) => decodeEntities(
  String(html).match(new RegExp(`<meta\\b(?=[^>]*${selector})[^>]*\\bcontent="([^"]*)"[^>]*>`, 'i'))?.[1] ?? ''
)

const breadcrumb = (html, hrefPattern) => {
  let found = null
  for (const match of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], 'href')
    const classes = attribute(match[1], 'class') ?? ''
    if (href && classes.split(/\s+/).includes('breadcrumbs-item') && hrefPattern.test(href)) {
      found = { href, label: plainText(match[2]) }
    }
  }
  return found
}

export const parseIndexedParagraphContext = ({ html, paragraphId }) => {
  const book = breadcrumb(html, /^\/book\/b\d+$/)
  const section = breadcrumb(html, /^\/read\/[\d.]+$/)
  const bookTitle = metaContent(html, 'name="title"') || book?.label
  const bookCode = metaContent(html, 'name="keywords"')
  const sectionTitle = plainText(
    String(html).match(/<h1\b[^>]*class="[^"]*breadcrumbs-header-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  ) || section?.label

  if (!bookTitle || !sectionTitle) throw new Error('Métadonnées de contexte EGW absentes')

  return {
    book: {
      id: book?.href.match(/\/book\/b(\d+)/)?.[1] ?? paragraphId.split('.')[0],
      title: bookTitle,
      code: bookCode || null,
    },
    section: {
      pageId: section?.href.match(/\/read\/([\d.]+)/)?.[1] ?? null,
      title: sectionTitle,
      contextUrl: `https://text.egwwritings.org/read/${paragraphId}`,
    },
  }
}

const indexedParagraphDocument = ({ paragraph, context, chapterAssociation = null }) => {
  const sourceReference = plainText(
    paragraph.inner.match(/<span\b[^>]*class="[^"]*refCode[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
  )
  const body = detachString(normalizeEgwMarkup(paragraph.inner))
  if (!plainText(body)) throw new Error(`Paragraphe EGW vide : ${paragraph.id}`)
  const normalized = normalizeCommentaryContent({
    html: body,
    resourceId: 'egw-indexed-writings',
    language: 'en',
    passage: null,
  })
  return {
    schemaVersion: 1,
    id: paragraph.id,
    resource: {
      id: 'egw-indexed-writings',
      name: 'EGW Writings',
      author: 'Ellen G. White',
      sourceLanguage: 'en',
      license: 'CustomPermission',
    },
    book: context.book,
    section: {
      ...context.section,
      contextUrl: `https://text.egwwritings.org/read/${paragraph.id}`,
    },
    sourceReference: sourceReference || null,
    chapterAssociation,
    source: {
      language: 'en',
      html: normalized.html,
      ...(normalized.references.length ? { references: normalized.references } : {}),
      sha256: sha256(normalized.html),
      provenance: `EGW Writings · ${context.book.code || context.book.title} · ${paragraph.id}`,
      url: `https://text.egwwritings.org/read/${paragraph.id}`,
    },
  }
}

export const parseIndexedParagraphPage = ({ html, targetParagraphIds }) => {
  const targets = targetParagraphIds instanceof Set ? targetParagraphIds : new Set(targetParagraphIds)
  const firstTarget = targets.values().next().value ?? 'unknown'
  const pageContext = parseIndexedParagraphContext({ html, paragraphId: firstTarget })
  const paragraphs = []
  for (const match of String(html).matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const id = match[1].match(/\bid="([^"]+)"/i)?.[1]
    if (!id || !targets.has(id)) continue
    paragraphs.push(indexedParagraphDocument({ paragraph: { id, inner: match[2] }, context: pageContext }))
  }
  return paragraphs
}

export const isIndexedSectionAnchor = ({ html, targetParagraphId }) => {
  const paragraphs = paragraphMatches(html)
    .filter(paragraph => paragraph.id && paragraph.classes.split(/\s+/).includes('para'))
  const targetIndex = paragraphs.findIndex(paragraph => paragraph.id === targetParagraphId)
  if (targetIndex !== 0 || paragraphs.length < 2) return false
  const target = paragraphs[targetIndex]
  const sourceReference = plainText(
    target.inner.match(/<span\b[^>]*class="[^"]*refCode[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
  )
  const text = plainText(normalizeEgwMarkup(target.inner))
  return !sourceReference && text.length > 0 && text.length <= 160
}

export const parseIndexedHeadingSectionPage = ({ html, context, anchorParagraphId }) =>
  paragraphMatches(html)
    .filter(paragraph => paragraph.id && paragraph.classes.split(/\s+/).includes('para'))
    .filter(paragraph => paragraph.id !== anchorParagraphId && !isChapterAssociationMarker(paragraph.inner))
    .map(paragraph => indexedParagraphDocument({ paragraph, context }))

export const parseIndexedSectionPage = ({ html, context, markerParagraphId, markerText }) => paragraphMatches(html)
  .filter(paragraph => paragraph.id && paragraph.classes.split(/\s+/).includes('para'))
  .filter(paragraph => paragraph.id !== markerParagraphId && !isChapterAssociationMarker(paragraph.inner))
  .map(paragraph => indexedParagraphDocument({
    paragraph,
    context,
    chapterAssociation: {
      kind: 'chapter',
      markerParagraphId,
      markerText: plainText(markerText),
    },
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
