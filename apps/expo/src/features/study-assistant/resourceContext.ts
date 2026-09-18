import i18n from '~i18n'
import type { ReadingContext } from './conversations'
import verseToReference from '~helpers/verseToReference'
import { parseCommentaryResourceParams } from '~features/commentaries/commentaryResourceParams'
const context = (
  kind: ReadingContext['kind'],
  label: string,
  details: string[]
): ReadingContext => ({
  kind,
  label: label.slice(0, 450),
  detail: details.filter(Boolean).join(' · ').slice(0, 500),
  key: JSON.stringify([kind, ...details]).slice(0, 990),
})
export function commentaryContext(
  data: {
    projectionId?: string
    book?: string | number
    chapter?: string | number
    sectionId?: string
  },
  section?: { id: string; rangeStartVerse: number; rangeEndVerse: number }
): ReadingContext | null {
  const parsed = parseCommentaryResourceParams({
    projectionId: data.projectionId,
    book: String(data.book ?? ''),
    chapter: String(data.chapter ?? ''),
  })
  if (!parsed || parsed.book > 66 || parsed.chapter > 150) return null
  const reference = verseToReference({
    bookNum: parsed.book,
    chapterNum: parsed.chapter,
    verses:
      section && section.rangeStartVerse > 0
        ? Array.from(
            { length: Math.min(176, section.rangeEndVerse - section.rangeStartVerse + 1) },
            (_, i) => section.rangeStartVerse + i
          )
        : undefined,
  })
  return context('commentary', `${parsed.entry.author} · ${reference}`, [
    `Commentaire ouvert : ${parsed.entry.title}`,
    `Auteur : ${parsed.entry.author}`,
    reference,
    `resourceId=${parsed.projection.resourceId}; langue=${parsed.projection.language}`,
    data.sectionId ? `sectionId=${data.sectionId}` : '',
    "Texte non fourni : consulter cet auteur avant de l'expliquer ; ne pas substituer un autre commentaire.",
  ])
}
export function dictionaryContext(data: {
  word?: string
  work?: string
  dictionaryTitle?: string
  entryId?: number
  language?: string
}): ReadingContext | null {
  if (!data.word?.trim()) return null
  const title = data.dictionaryTitle || data.work || i18n.t('Dictionnaire')
  return context('dictionary', `${data.word} · ${title}`, [
    `Article ouvert : ${data.word}`,
    `Dictionnaire : ${title}`,
    data.work ? `work=${data.work}` : '',
    data.entryId ? `entryId=${data.entryId}` : '',
    data.language ? `langue=${data.language}` : '',
    "Texte non fourni : lire cet article avant de l'expliquer.",
  ])
}
export function naveContext(data: {
  name?: string
  name_lower?: string
  language?: string
}): ReadingContext | null {
  if (!data.name && !data.name_lower) return null
  return context('nave', `${data.name || data.name_lower} · Nave`, [
    `Thème Nave ouvert : ${data.name || data.name_lower}`,
    data.name_lower ? `normalizedName=${data.name_lower}` : '',
    data.language ? `langue=${data.language}` : '',
    "Texte non fourni : lire ce thème avant d'expliquer ses références.",
  ])
}
export function pickReadingContext({
  panelOpen,
  reader,
  panel,
  location,
  interaction,
}: {
  panelOpen: boolean
  reader: ReadingContext | null
  panel: ReadingContext | null
  location: string
  interaction: { location: string; surface: 'reader' | 'panel' } | null
}): ReadingContext | null {
  if (!panelOpen) return reader
  return interaction?.location === location && interaction.surface === 'reader' ? reader : panel
}

export function bibleContext(tab: import('~state/tabs').BibleTab): ReadingContext {
  const data = tab.data,
    keys = Object.keys(data.selectedVerses || {})
  const label = keys.length
    ? verseToReference(keys)
    : verseToReference({
        bookNum: data.selectedBook.Numero,
        chapterNum: data.selectedChapter,
        verses: data.focusVerses,
      })
  const detail = `${label} · ${data.selectedVersion}`.slice(0, 500)
  return {
    key: `${tab.id}:${detail}`,
    label: label.slice(0, 450),
    detail,
    kind: 'passage',
    bibleVersion: data.selectedVersion,
  }
}

export function commentaryCollectionContext(
  verse: string,
  projections: string[] = []
): ReadingContext | null {
  if (!/^\d+-\d+-\d+$/.test(verse)) return null
  const [book, chapter, number] = verse.split('-').map(Number)
  if (book < 1 || book > 66 || chapter < 1 || chapter > 150 || number < 1 || number > 176)
    return null
  const reference = verseToReference({ bookNum: book, chapterNum: chapter, verses: [number] })
  const authors = projections.flatMap(projectionId => {
    const parsed = parseCommentaryResourceParams({
      projectionId,
      book: String(book),
      chapter: String(chapter),
    })
    return parsed ? [`${parsed.entry.author} (${projectionId})`] : []
  })
  return context('commentary', `${i18n.t('Commentaires')} · ${reference}`, [
    `Liste de commentaires ouverte : ${reference}`,
    authors.join(', '),
    "Aucun auteur unique sélectionné. Préciser l'auteur si nécessaire ; les textes ne sont pas fournis.",
  ])
}
