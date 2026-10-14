import { getSupportedOsisBookId } from '@bible-strong/bible-reference-parser/osis-reference'
import type { StudyLanguage } from '../language'

// Indexed by book number - 1: the Protestant canon, then the deuterocanonical books (67–77).
// The public site prints the same names (apps/site/features/bible/bibleBooks.ts).
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

export const BOOK_COUNT = BOOK_NAMES.length

export const bookName = (book: number, language: StudyLanguage): string =>
  BOOK_NAMES[book - 1]?.[language === 'fr' ? 0 : 1] ?? String(book)

/** The lowercase OSIS identity a public path names a book by. */
export const bookSlug = (book: number): string | undefined =>
  getSupportedOsisBookId(book)?.toLowerCase()

export const isOldTestament = (book: number): boolean => book <= 39 || book >= 67

// How the lexicon of people and places names the 66 books: neither OSIS nor a number.
const ENTITY_BOOK_CODES = (
  'Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng ' +
  'Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act ' +
  'Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev'
).split(' ')

export const entityBookCode = (book: number): string | undefined => ENTITY_BOOK_CODES[book - 1]
