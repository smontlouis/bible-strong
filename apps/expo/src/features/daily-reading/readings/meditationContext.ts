import type { ReadingContext } from '~features/study-assistant/conversations'
import type { DailyCard, DailyCollection, DailyEntry } from './dailyReadingFormat'
import { getVerseKeys } from './useVerseMeditation'

const MAX_CONTENT = 12000

type CardOf<T extends DailyCard['type']> = Extract<DailyCard, { type: T }>

/**
 * The context pinned to the conversation a reader opens from a question at the end of a verse
 * meditation (2026-11-26): the meditation itself and the question Strobi opens with. The Worker
 * recognises the frame by its resource (`verse-meditations-<language>`) and keeps a meditation's
 * posture for the whole conversation; the text is Bible Strong's own, sent as it is shown.
 * Its lines are the ones the Worker's meditation bench sends (bible-strong-ai,
 * scripts/evaluations/meditation-bench.mjs).
 */
export function meditationReadingContext({
  collection,
  entryKey,
  entry,
  question,
  version,
  label,
}: {
  collection: Pick<DailyCollection, 'id' | 'language'>
  entryKey: string
  entry: DailyEntry
  question: string
  /** The version the meditation quotes (LSG, BSB). */
  version: string
  /** The conversation's title: « Méditation · Ésaïe 30:21 ». */
  label: string
}): ReadingContext | null {
  const of = <T extends DailyCard['type']>(type: T) =>
    entry.cards.filter((card): card is CardOf<T> => card.type === type)
  const verse = of('verse')[0]
  if (!verse) return null
  const fr = collection.language !== 'en'
  const hook = of('hook')[0]
  const prayer = of('prayer')[0]
  const questions = of('questions')[0]
  const lines = [
    `${fr ? 'Question d’ouverture posée au lecteur par Strobi' : 'Opening question Strobi asked the reader'} : ${question}`,
    '',
    `${fr ? 'Verset' : 'Verse'} (${version}) : ${verse.text} — ${verse.label}`,
    ...(hook ? [`${fr ? 'Accroche' : 'Hook'} : ${hook.text}`] : []),
    ...of('part').map(
      part =>
        `${part.title} : ${part.text}${
          part.strong
            ? ` (${fr ? 'mot' : 'word'} ${part.strong.translit}, ${part.strong.code}, « ${part.strong.word} »)`
            : ''
        }`
    ),
    ...(prayer ? [`${fr ? 'Prière' : 'Prayer'} : ${prayer.text}`] : []),
    ...(questions?.items.length
      ? [
          `${fr ? 'Questions de la méditation' : 'Questions of the meditation'} : ${questions.items.join(' / ')}`,
        ]
      : []),
  ]
  // `ISA.30.21` → book 23, chapter 30, verse 21.
  const keys = getVerseKeys(entry.ref ?? '').map(key => key.split('-').map(Number))
  const [first, last] = [keys[0], keys.at(-1)]
  return {
    kind: 'meditation',
    key: `meditation:${collection.id}:${entryKey}`,
    label: label.slice(0, 500),
    detail:
      `${fr ? 'Méditation du verset de Bible Strong' : 'Bible Strong verse meditation'} : ${verse.label}. Ressource=${collection.id}; entrée=${entryKey}; langue=${fr ? 'fr' : 'en'}`.slice(
        0,
        500
      ),
    content: lines.join('\n').slice(0, MAX_CONTENT),
    bibleVersion: version,
    opening: question.slice(0, 500),
    activeContext: {
      kind: 'meditation',
      resourceId: collection.id,
      sectionId: entryKey,
      language: fr ? 'fr' : 'en',
      reference: verse.label.slice(0, 200),
      ...(first && last
        ? { book: first[0], chapter: first[1], startVerse: first[2], endVerse: last[2] }
        : {}),
    },
  }
}
