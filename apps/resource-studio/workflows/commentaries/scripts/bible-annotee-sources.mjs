import { sha256 } from './wave-sources.mjs'

export const BIBLE_ANNOTEE_RESOURCE = {
  id: 'bible-annotee',
  name: 'Bible Annotée de Neuchâtel',
  author: 'Collectif Bonnet, Bovet, Godet et collaborateurs',
  sourceLanguage: 'fr',
  license: 'CustomPermission',
}

const oldTestamentData = [
  ['Genèse', 'gen', 50, 1], ['Exode', 'exo', 40, 2], ['Lévitique', 'lev', 27, 3],
  ['Nombres', 'nom', 36, 4], ['Deutéronome', 'deu', 34, 5], ['Josué', 'josue', 24, 6],
  ['Juges', 'juges', 21, 7], ['Ruth', 'ruth', 4, 8], ['1 Samuel', '1samuel', 31, 9],
  ['2 Samuel', '2samuel', 24, 10], ['1 Rois', '1rois', 22, 11], ['2 Rois', '2rois', 25, 12],
  ['1 Chroniques', '1chroniques', 29, 13], ['2 Chroniques', '2chroniques', 36, 14],
  ['Esdras', 'esdras', 10, 15], ['Néhémie', 'nehemie', 13, 16], ['Esther', 'esther', 10, 17],
  ['Job', 'job', 42, 18], ['Proverbes', 'proverbes', 31, 20], ['Ecclésiaste', 'ecclesiaste', 12, 21],
  ['Cantique des cantiques', 'cantique', 8, 22], ['Psaumes', 'psaumes', 150, 19],
  ['Ésaïe', 'esaie', 66, 23], ['Jérémie', 'jeremie', 52, 24], ['Lamentations', 'lamentations', 5, 25],
  ['Ézéchiel', 'ezechiel', 48, 26], ['Daniel', 'daniel', 12, 27], ['Osée', 'osee', 14, 28],
  ['Joël', 'joel', 3, 29], ['Amos', 'amos', 9, 30], ['Abdias', 'abdias', 1, 31],
  ['Jonas', 'jonas', 4, 32], ['Michée', 'michee', 7, 33], ['Nahum', 'nahum', 3, 34],
  ['Habacuc', 'habakuk', 3, 35], ['Sophonie', 'sophonie', 3, 36], ['Aggée', 'aggee', 2, 37],
  ['Zacharie', 'zacharie', 14, 38], ['Malachie', 'malachie', 4, 39],
]

const newTestamentData = [
  ['Matthieu', 'Matthieu', 40], ['Marc', 'Marc', 41], ['Luc', 'Luc', 42], ['Jean', 'Jean', 43],
  ['Actes', 'Actes', 44], ['Romains', 'Romains', 45], ['1 Corinthiens', '1Corinthiens', 46],
  ['2 Corinthiens', '2Corinthiens', 47], ['Galates', 'Galates', 48], ['Éphésiens', 'Ephesiens', 49],
  ['Philippiens', 'Philippiens', 50], ['Colossiens', 'Colossiens', 51],
  ['1 Thessaloniciens', '1Thessaloniciens', 52], ['2 Thessaloniciens', '2Thessaloniciens', 53],
  ['1 Timothée', '1Timothee', 54], ['2 Timothée', '2Timothee', 55], ['Tite', 'Tite', 56],
  ['Philémon', 'Philemon', 57], ['Hébreux', 'Hebreux', 58], ['Jacques', 'Jacques', 59],
  ['1 Pierre', '1Pierre', 60], ['2 Pierre', '2Pierre', 61], ['1 Jean', '1Jean', 62],
  ['2 Jean', '2Jean', 63], ['3 Jean', '3Jean', 64], ['Jude', 'Jude', 65],
  ['Apocalypse', 'Apocalypse', 66],
]

export const BIBLE_ANNOTEE_OLD_TESTAMENT = oldTestamentData.map(([name, slug, chapters, book]) => ({ name, slug, chapters, book }))
export const BIBLE_ANNOTEE_NEW_TESTAMENT = newTestamentData.map(([name, slug, book]) => ({ name, slug, book }))

export const decodeTheotex = bytes => new TextDecoder('windows-1252').decode(bytes)

const decodeEntities = value => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&oelig;|&#156;|&#x9c;/gi, 'œ')
  .replace(/&aelig;/gi, 'æ')
  .replace(/&laquo;/gi, '«')
  .replace(/&raquo;/gi, '»')
  .replace(/&mdash;/gi, '—')
  .replace(/&ndash;/gi, '–')
  .replace(/&hellip;/gi, '…')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

export const normalizeTheotexMarkup = value => decodeEntities(String(value ?? ''))
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '')
  .replace(/<font\b[^>]*class\s*=\s*["']?(?:mul|titre1|bb)["']?[^>]*>([\s\S]*?)<\/font>/gi, '<strong>$1</strong>')
  .replace(/<font\b[^>]*class\s*=\s*["']?(?:eph|auteur)["']?[^>]*>([\s\S]*?)<\/font>/gi, '<em>$1</em>')
  .replace(/<font\b[^>]*class\s*=\s*["']?(?:ref|sm|notes)["']?[^>]*>([\s\S]*?)<\/font>/gi, '<span class="ref">$1</span>')
  .replace(/<font\b[^>]*class\s*=\s*["']?(?:bib|cb)["']?[^>]*>([\s\S]*?)<\/font>/gi, '<strong>$1</strong>')
  .replace(/<font\b[^>]*>([\s\S]*?)<\/font>/gi, '$1')
  .replace(/<(?:i|em)\b[^>]*>/gi, '<em>').replace(/<\/(?:i|em)>/gi, '</em>')
  .replace(/<(?:b|strong)\b[^>]*>/gi, '<strong>').replace(/<\/(?:b|strong)>/gi, '</strong>')
  .replace(/<small\b[^>]*>/gi, '<span class="ref">').replace(/<\/small>/gi, '</span>')
  .replace(/<h([1-6])\b[^>]*>/gi, '<h4>').replace(/<\/h[1-6]>/gi, '</h4>')
  .replace(/<(p|ul|ol|li|br|h4)\b[^>]*>/gi, '<$1>')
  .replace(/<\/(p|ul|ol|li|h4)>/gi, '</$1>')
  .replace(/<(?!\/?(?:p|ul|ol|li|br|h4|strong|em|span)\b)[^>]+>/gi, '')
  .replace(/<p>\s*<(ul|ol)>/gi, '<$1>').replace(/<\/(ul|ol)>\s*<\/p>/gi, '</$1>')
  .replace(/^(?:\s*<\/(?:p|ul|ol|li|h4|strong|em|span)>)+/i, '')
  .replace(/^(?!\s*<(?:p|h4|ul|ol)\b)([\s\S]*?)<\/p>/i, '<p>$1</p>')
  .replace(/^(\s*[^<][\s\S]*?)<\/p>/i, '<p>$1</p>')
  .replace(/<li>(?=[^<])/gi, '<li>')
  .replace(/\s+/g, ' ')
  .replace(/>\s+</g, '><')
  .trim()

const plainText = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

const makeEntry = ({ passage, html, sourceUrl, sequence = 1, kind = 'commentary' }) => {
  const normalized = normalizeTheotexMarkup(html)
  if (!plainText(normalized)) return null
  const provenance = `ThéoTeX · Bible Annotée de Neuchâtel · ${sourceUrl}`
  const sourceKey = new URL(sourceUrl).pathname.split('/').pop().replace(/\.html?$/i, '').replace(/[^a-z0-9_-]+/gi, '-')
  return {
    schemaVersion: 1,
    id: `bible-annotee:${passage}:${kind}:${sourceKey}:${sequence}`,
    passage,
    resource: BIBLE_ANNOTEE_RESOURCE,
    source: { language: 'fr', html: '', sha256: null, provenance: 'Texte original français affiché dans la colonne française' },
    translation: { language: 'fr', html: normalized, sha256: sha256(normalized), provenance },
    editorialKind: kind,
  }
}

export const parseOldTestamentCommentary = ({ html, book, chapter, sourceUrl }) => {
  const entries = []
  const pattern = /<div\b[^>]*class\s*=\s*["']?num["']?[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div\b[^>]*class\s*=\s*["']?def["']?[^>]*>([\s\S]*?)<\/div>/gi
  const sequences = new Map()
  for (const match of html.matchAll(pattern)) {
    const verseText = plainText(normalizeTheotexMarkup(match[1]))
    const verse = verseText ? Number.parseInt(verseText, 10) : 0
    if (!Number.isInteger(verse) || verse < 0) continue
    const passage = `${book}-${chapter}-${verse}`
    const sequence = (sequences.get(passage) ?? 0) + 1
    sequences.set(passage, sequence)
    const entry = makeEntry({ passage, html: match[2], sourceUrl, sequence, kind: verse === 0 ? 'chapter-introduction' : 'commentary' })
    if (entry) entries.push(entry)
  }
  return entries
}

export const extractNewTestamentPageLinks = ({ html, slug }) => [...new Set(
  [...html.matchAll(new RegExp(`href=["'](${slug}_nta_\\d+\\.html)["']`, 'gi'))].map(match => match[1])
)].sort((left, right) => Number(left.match(/(\d+)\.html$/)[1]) - Number(right.match(/(\d+)\.html$/)[1]))

export const parseNewTestamentCommentary = ({ html, book, sourceUrl }) => {
  const entries = []
  let currentPassage = null
  let currentHtml = []
  const flush = () => {
    if (!currentPassage || currentHtml.length === 0) return
    const entry = makeEntry({ passage: currentPassage, html: currentHtml.join(' '), sourceUrl })
    if (entry) entries.push(entry)
    currentHtml = []
  }
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowMatch[1]
    const verseMatch = row.match(/<td\b[^>]*class\s*=\s*["']?nm["']?[^>]*>[\s\S]*?<font\b[^>]*class\s*=\s*["']?cp["']?[^>]*>\s*(\d+)\s*<\/font>[\s\S]*?<font\b[^>]*class\s*=\s*["']?vs["']?[^>]*>\s*\.\s*(\d+)\s*<\/font>/i)
    if (verseMatch) {
      flush()
      currentPassage = `${book}-${Number(verseMatch[1])}-${Number(verseMatch[2])}`
      continue
    }
    const noteMatch = row.match(/<td\b[^>]*class\s*=\s*["']?nt["']?[^>]*>([\s\S]*?)<\/td>/i)
    if (noteMatch && currentPassage) currentHtml.push(noteMatch[1])
  }
  flush()
  return entries
}

export const parseNewTestamentIntroduction = ({ html, book, sourceUrl }) => {
  const table = html.match(/<table\b[^>]*class\s*=\s*["']?intro["']?[^>]*>([\s\S]*?)<\/table>/i)?.[1]
  const entry = makeEntry({ passage: `${book}-0-0`, html: table ?? '', sourceUrl, kind: 'book-introduction' })
  return entry ? [entry] : []
}
