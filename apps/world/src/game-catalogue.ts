/** Shared catalogue contracts; no answer data is imported into the live client. */
export type BibleReference = { book: number; chapter: number; verse: number }
export type CatalogueCopy = { answer: string; aliases: string[]; explanation: string }
export type CatalogueQuestion = {
  id: string
  difficulty: 'easy' | 'medium' | 'hard'
  testament: 'old' | 'new'
  factKey: string
  reference: BibleReference
  fr: CatalogueCopy & { question: string }
  en: CatalogueCopy & { question: string }
  sourceUrl: string
}
export type CatalogueIdentity = {
  id: string
  category: 'person' | 'place' | 'object'
  testament: 'old' | 'new'
  fr: CatalogueCopy
  en: CatalogueCopy
  clues: { points: number; fr: string; en: string; reference: BibleReference; sourceUrl: string }[]
}
type Language = 'fr' | 'en'
const books = {
  fr: 'Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1 Samuel|2 Samuel|1 Rois|2 Rois|1 Chroniques|2 Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique des cantiques|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1 Corinthiens|2 Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1 Thessaloniciens|2 Thessaloniciens|1 Timothée|2 Timothée|Tite|Philémon|Hébreux|Jacques|1 Pierre|2 Pierre|1 Jean|2 Jean|3 Jean|Jude|Apocalypse'.split(
    '|'
  ),
  en: 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split(
    '|'
  ),
}
export function referenceLabel(q: { reference: BibleReference }, language: Language) {
  return `${books[language][q.reference.book - 1]} ${q.reference.chapter}:${q.reference.verse}`
}
