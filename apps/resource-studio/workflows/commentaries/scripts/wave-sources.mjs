import { createHash } from 'node:crypto'

export const PROTESTANT_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Songs',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
  'Tobit', 'Judith', 'Wisdom', 'Sirach', 'Baruch', '1 Maccabees', '2 Maccabees',
]

const aliases = {
  Psalm: 'Psalms',
  'Song of Solomon': 'Song of Songs',
  'I Samuel': '1 Samuel',
  'II Samuel': '2 Samuel',
  'I Kings': '1 Kings',
  'II Kings': '2 Kings',
  'I Chronicles': '1 Chronicles',
  'II Chronicles': '2 Chronicles',
  'I Corinthians': '1 Corinthians',
  'II Corinthians': '2 Corinthians',
  'I Thessalonians': '1 Thessalonians',
  'II Thessalonians': '2 Thessalonians',
  'I Timothy': '1 Timothy',
  'II Timothy': '2 Timothy',
  'I Peter': '1 Peter',
  'II Peter': '2 Peter',
  'I John': '1 John',
  'II John': '2 John',
  'III John': '3 John',
  'Revelation of John': 'Revelation',
  'I Maccabees': '1 Maccabees',
  'II Maccabees': '2 Maccabees',
}

export const bookNumber = name => {
  const canonical = aliases[name] ?? name
  const index = PROTESTANT_BOOKS.indexOf(canonical)
  if (index < 0) throw new Error(`Livre biblique non reconnu : ${name}`)
  return index + 1
}

export const CROSSWIRE_RESOURCES = [
  { id: 'mhcc', module: 'MHCC', language: 'en', title: 'Matthew Henry Concise Commentary', author: 'Matthew Henry', license: 'PublicDomain' },
  { id: 'jfb', module: 'JFB', language: 'en', title: 'Jamieson–Fausset–Brown Commentary', author: 'R. Jamieson, A. R. Fausset, D. Brown', license: 'PublicDomain' },
  { id: 'wesley', module: 'Wesley', language: 'en', title: 'John Wesley’s Notes on the Bible', author: 'John Wesley', license: 'PublicDomain' },
  { id: 'fre-aug', module: 'FreAug', language: 'fr', title: 'Commentaires de saint Augustin', author: 'Augustin d’Hippone', license: 'PublicDomain' },
  { id: 'fre-chry', module: 'FreChry', language: 'fr', title: 'Commentaires de saint Jean Chrysostome', author: 'Jean Chrysostome', license: 'PublicDomain' },
  { id: 'calvin', module: 'CalvinCommentaries', language: 'en', title: 'Calvin’s Commentaries', author: 'Jean Calvin', license: 'PublicDomain' },
  { id: 'treasury-david', module: 'TDavid', language: 'en', title: 'The Treasury of David', author: 'Charles H. Spurgeon', license: 'PublicDomain' },
]

export const RASHI_BOOKS = new Map([
  ['Genesis', 1], ['Exodus', 2], ['Leviticus', 3], ['Numbers', 4], ['Deuteronomy', 5],
  ['Joshua', 6], ['Judges', 7], ['Ruth', 8], ['I Samuel', 9], ['II Samuel', 10],
  ['I Kings', 11], ['II Kings', 12], ['I Chronicles', 13], ['II Chronicles', 14],
  ['Ezra', 15], ['Nehemiah', 16], ['Esther', 17], ['Job', 18], ['Psalms', 19],
  ['Proverbs', 20], ['Ecclesiastes', 21], ['Song of Songs', 22], ['Isaiah', 23],
  ['Jeremiah', 24], ['Lamentations', 25], ['Ezekiel', 26], ['Daniel', 27], ['Hosea', 28],
  ['Joel', 29], ['Amos', 30], ['Obadiah', 31], ['Jonah', 32], ['Micah', 33], ['Nahum', 34],
  ['Habakkuk', 35], ['Zephaniah', 36], ['Haggai', 37], ['Zechariah', 38], ['Malachi', 39],
])

const rashiPreferredVersions = [
  'Rashi Chumash, Metsudah Publications, 2009',
  'The Judaica Press complete Tanach with Rashi, translated by A. J. Rosenberg',
  'The Metsudah Tanach series, Lakewood, N.J',
  'The Book of Joshua, Metsudah Publications, 1997',
  'The Metsudah Five Megillot, Lakewood, N.J., 2001',
]

export const selectRashiEditions = books => [...RASHI_BOOKS].map(([bookName, book]) => {
  const title = `Rashi on ${bookName}`
  const candidates = books.filter(entry =>
    entry.title === title && entry.language === 'English' && entry.categories?.includes('Tanakh')
  )
  const edition = rashiPreferredVersions
    .map(versionTitle => candidates.find(candidate => candidate.versionTitle === versionTitle))
    .find(Boolean)
  if (!edition) throw new Error(`Aucune édition anglaise autorisée sélectionnée pour ${title}`)
  return { ...edition, book, bookName }
})

export const normalizeSourceMarkup = value => String(value ?? '')
  .replace(/<milestone\b[^>]*\/?\s*>/gi, '')
  .replace(/<(?:chapter|div)\b[^>]*(?:sID|eID)="[^"]*"[^>]*\/?\s*>/gi, '')
  .replace(/<title\b[^>]*>([\s\S]*?)<\/title>/gi, '<h4>$1</h4>')
  .replace(/<hi\b[^>]*type="(?:bold|x-b)"[^>]*>([\s\S]*?)<\/hi>/gi, '<strong>$1</strong>')
  .replace(/<hi\b[^>]*type="(?:italic|x-i)"[^>]*>([\s\S]*?)<\/hi>/gi, '<em>$1</em>')
  .replace(/<hi\b[^>]*>([\s\S]*?)<\/hi>/gi, '<span>$1</span>')
  .replace(/<reference\b([^>]*)>([\s\S]*?)<\/reference>/gi, (_, attributes, inner) => {
    const osis = attributes.match(/\bosisRef="(?:Bible:)?([^"]+)"/i)?.[1]
    return osis
      ? `<span class="ref" data-osis="${osis.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${inner}</span>`
      : `<span class="ref">${inner}</span>`
  })
  .replace(/<row\b[^>]*>/gi, '<p>')
  .replace(/<\/row>/gi, '</p>')
  .replace(/<cell\b[^>]*>/gi, '<span>')
  .replace(/<\/cell>/gi, ' </span>')
  .replace(/<(?:table|\/table)\b[^>]*>/gi, '')
  .replace(/<div\b[^>]*>/gi, '<p>')
  .replace(/<\/div>/gi, '</p>')
  .replace(/<p>\s*<\/p>/gi, '')
  .replace(/(?:\s*<br\s*\/?>\s*){3,}/gi, '<br><br>')
  .replace(/\s+/g, ' ')
  .trim()

export const parseImp = (raw, resource) => {
  const entries = []
  const parts = String(raw).replace(/^\uFEFF/, '').split(/^\$\$\$/m).slice(1)
  for (const part of parts) {
    const newline = part.indexOf('\n')
    const key = (newline < 0 ? part : part.slice(0, newline)).trim()
    const match = key.match(/^(.+?)\s+(\d+):(\d+)$/)
    if (!match) continue
    const [, bookName, chapter, verse] = match
    const html = normalizeSourceMarkup(newline < 0 ? '' : part.slice(newline + 1))
    const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (!plainText || /^(?:\[\]|\{\}|null|undefined|n\/a|-)$/i.test(plainText)) continue
    const passage = `${bookNumber(bookName)}-${Number(chapter)}-${Number(verse)}`
    const id = `${resource.id}:${passage}:${entries.length + 1}`
    const provenance = `CrossWire ${resource.module}`
    const source = resource.language === 'en'
      ? { language: 'en', html, sha256: sha256(html), provenance }
      : { language: 'fr', html: '', sha256: null, provenance: 'Texte original français affiché dans la colonne française' }
    const translation = resource.language === 'fr'
      ? { language: 'fr', html, sha256: sha256(html), provenance }
      : null
    entries.push({
      schemaVersion: 1,
      id,
      passage,
      resource: { id: resource.id, name: resource.title, author: resource.author, sourceLanguage: resource.language, license: resource.license },
      source,
      translation,
    })
  }
  return entries
}

export const sha256 = value => createHash('sha256').update(value).digest('hex')
