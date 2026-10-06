import { getSupportedOsisBookId } from '@bible-strong/bible-reference-parser/osis-reference'
import type { ResourceLanguage } from '../resources/publicSite'

// Indexed by book number - 1: the Protestant canon, then the deuterocanonical books (67–77).
const BOOK_NAMES: readonly (readonly [fr: string, en: string])[] = [
  ['Genèse', 'Genesis'],
  ['Exode', 'Exodus'],
  ['Lévitique', 'Leviticus'],
  ['Nombres', 'Numbers'],
  ['Deutéronome', 'Deuteronomy'],
  ['Josué', 'Joshua'],
  ['Juges', 'Judges'],
  ['Ruth', 'Ruth'],
  ['1 Samuel', '1 Samuel'],
  ['2 Samuel', '2 Samuel'],
  ['1 Rois', '1 Kings'],
  ['2 Rois', '2 Kings'],
  ['1 Chroniques', '1 Chronicles'],
  ['2 Chroniques', '2 Chronicles'],
  ['Esdras', 'Ezra'],
  ['Néhémie', 'Nehemiah'],
  ['Esther', 'Esther'],
  ['Job', 'Job'],
  ['Psaumes', 'Psalms'],
  ['Proverbes', 'Proverbs'],
  ['Ecclésiaste', 'Ecclesiastes'],
  ['Cantique des Cantiques', 'Song of Songs'],
  ['Ésaïe', 'Isaiah'],
  ['Jérémie', 'Jeremiah'],
  ['Lamentations', 'Lamentations'],
  ['Ézéchiel', 'Ezekiel'],
  ['Daniel', 'Daniel'],
  ['Osée', 'Hosea'],
  ['Joël', 'Joel'],
  ['Amos', 'Amos'],
  ['Abdias', 'Obadiah'],
  ['Jonas', 'Jonah'],
  ['Michée', 'Micah'],
  ['Nahum', 'Nahum'],
  ['Habacuc', 'Habakkuk'],
  ['Sophonie', 'Zephaniah'],
  ['Aggée', 'Haggai'],
  ['Zacharie', 'Zechariah'],
  ['Malachie', 'Malachi'],
  ['Matthieu', 'Matthew'],
  ['Marc', 'Mark'],
  ['Luc', 'Luke'],
  ['Jean', 'John'],
  ['Actes', 'Acts'],
  ['Romains', 'Romans'],
  ['1 Corinthiens', '1 Corinthians'],
  ['2 Corinthiens', '2 Corinthians'],
  ['Galates', 'Galatians'],
  ['Éphésiens', 'Ephesians'],
  ['Philippiens', 'Philippians'],
  ['Colossiens', 'Colossians'],
  ['1 Thessaloniciens', '1 Thessalonians'],
  ['2 Thessaloniciens', '2 Thessalonians'],
  ['1 Timothée', '1 Timothy'],
  ['2 Timothée', '2 Timothy'],
  ['Tite', 'Titus'],
  ['Philémon', 'Philemon'],
  ['Hébreux', 'Hebrews'],
  ['Jacques', 'James'],
  ['1 Pierre', '1 Peter'],
  ['2 Pierre', '2 Peter'],
  ['1 Jean', '1 John'],
  ['2 Jean', '2 John'],
  ['3 Jean', '3 John'],
  ['Jude', 'Jude'],
  ['Apocalypse', 'Revelation'],
  ['Tobie', 'Tobit'],
  ['Judith', 'Judith'],
  ['Sagesse', 'Wisdom'],
  ['Siracide', 'Sirach'],
  ['Baruch', 'Baruch'],
  ['1 Maccabées', '1 Maccabees'],
  ['2 Maccabées', '2 Maccabees'],
  ['1 Esdras', '1 Esdras'],
  ['3 Maccabées', '3 Maccabees'],
  ['4 Maccabées', '4 Maccabees'],
  ['Psaumes de Salomon', 'Psalms of Solomon'],
]

export const bibleBookName = (book: number, language: ResourceLanguage): string =>
  BOOK_NAMES[book - 1]?.[language === 'fr' ? 0 : 1] ?? String(book)

const bookNumbersBySlug = new Map(
  BOOK_NAMES.flatMap((_, index) => {
    const osisId = getSupportedOsisBookId(index + 1)
    return osisId ? [[osisId.toLowerCase(), index + 1] as const] : []
  })
)

/** The lowercase OSIS identity used in public paths (ADR-0053). */
export const bibleBookSlug = (book: number): string | undefined =>
  getSupportedOsisBookId(book)?.toLowerCase()

export const findBibleBook = (slug: string | undefined): number | undefined =>
  slug ? bookNumbersBySlug.get(slug.toLowerCase()) : undefined
