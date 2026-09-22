export type Language = 'fr' | 'en'
export type Copy = { question: string; answer: string; aliases: string[]; explanation: string }
export type Question = {
  id: string
  difficulty: 'easy' | 'medium' | 'hard'
  testament: 'old' | 'new'
  factKey: string
  reference: { book: number; chapter: number; verse: number }
  fr: Copy
  en: Copy
  sourceUrl: string
}
export type Review = { status: 'pending' | 'approved' | 'revise'; note: string }
export type Reviews = Record<string, Review>
export const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
export function nextQuestion(questions: Question[], seen: string[], random = Math.random) {
  const fresh = questions.filter(q => !seen.includes(q.id))
  if (fresh.length) return fresh[Math.floor(random() * fresh.length)]
  return [...questions].sort((a, b) => seen.indexOf(a.id) - seen.indexOf(b.id))[0]
}
export function exactAnswer(q: Question, language: Language, answer: string) {
  return [q[language].answer, ...q[language].aliases].some(a => normalize(a) === normalize(answer))
}

const books = {
  fr: 'Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1 Samuel|2 Samuel|1 Rois|2 Rois|1 Chroniques|2 Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique des cantiques|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1 Corinthiens|2 Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1 Thessaloniciens|2 Thessaloniciens|1 Timothée|2 Timothée|Tite|Philémon|Hébreux|Jacques|1 Pierre|2 Pierre|1 Jean|2 Jean|3 Jean|Jude|Apocalypse'.split(
    '|'
  ),
  en: 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split(
    '|'
  ),
}
export function referenceLabel(q: Question, language: Language) {
  return `${books[language][q.reference.book - 1]} ${q.reference.chapter}:${q.reference.verse}`
}
