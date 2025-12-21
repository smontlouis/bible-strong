import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '~redux/modules/reducer'
import { HighlightsObj, NotesObj, LinksObj, Note, Highlight, Link } from '~redux/modules/user'
import { Tag, CurrentTheme } from '~common/types'

// Base selectors
const selectHighlights = (state: RootState) => state.user.bible.highlights
const selectNotes = (state: RootState) => state.user.bible.notes
const selectLinks = (state: RootState) => state.user.bible.links
const selectStudies = (state: RootState) => state.user.bible.studies
const selectNaves = (state: RootState) => state.user.bible.naves
const selectWords = (state: RootState) => state.user.bible.words
const selectStrongsGrec = (state: RootState) => state.user.bible.strongsGrec
const selectStrongsHebreu = (state: RootState) => state.user.bible.strongsHebreu
const selectSettings = (state: RootState) => state.user.bible.settings
const selectColors = (state: RootState) => state.user.bible.settings.colors

// Selector factory for highlights by chapter
// Usage: const selectHighlightsByChapter = useMemo(() => makeHighlightsByChapterSelector(), [])
export const makeHighlightsByChapterSelector = () =>
  createSelector(
    [
      selectHighlights,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (highlights, prefix): HighlightsObj => {
      const result: HighlightsObj = {}
      for (const key in highlights) {
        if (key.startsWith(prefix)) {
          result[key] = highlights[key]
        }
      }
      return result
    }
  )

// Selector factory for notes by chapter
export const makeNotesByChapterSelector = () =>
  createSelector(
    [
      selectNotes,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (notes, prefix): NotesObj => {
      const result: NotesObj = {}
      for (const key in notes) {
        if (key.startsWith(prefix)) {
          result[key] = notes[key]
        }
      }
      return result
    }
  )

// Selector factory for links by chapter
export const makeLinksByChapterSelector = () =>
  createSelector(
    [
      selectLinks,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (links, prefix): LinksObj => {
      const result: LinksObj = {}
      for (const key in links) {
        if (key.startsWith(prefix)) {
          result[key] = links[key]
        }
      }
      return result
    }
  )

// Selector for checking if any selected verse is highlighted
export const makeIsSelectedVerseHighlightedSelector = () =>
  createSelector(
    [
      selectHighlights,
      (_: RootState, selectedVerses: { [key: string]: boolean }) => selectedVerses,
    ],
    (highlights, selectedVerses): boolean => {
      return Object.keys(selectedVerses).some(verse => Boolean(highlights[verse]))
    }
  )

// Selector factory for colors by theme
export const makeColorsByThemeSelector = () =>
  createSelector(
    [selectColors, (_: RootState, theme: CurrentTheme) => theme],
    (colors, theme) => colors[theme]
  )

// Helper function for TagScreen - sorts verses by date
const sortVersesByDate = (p: Record<string, Highlight>) =>
  Object.keys(p).reduce((arr: any[], verse) => {
    const [Livre, Chapitre, Verset] = verse.split('-').map(Number)
    const formattedVerse = { Livre, Chapitre, Verset, Texte: '' }

    if (!arr.find((a: any) => a.date === p[verse].date)) {
      arr.push({
        date: p[verse].date,
        color: p[verse].color,
        verseIds: [],
        stringIds: {},
        tags: {},
      })
    }

    const dateInArray = arr.find((a: any) => a.date === p[verse].date)
    if (dateInArray) {
      dateInArray.stringIds[verse] = true
      dateInArray.verseIds.push(formattedVerse)
      dateInArray.verseIds.sort((a: any, b: any) => Number(a.Verset) - Number(b.Verset))
      dateInArray.tags = { ...dateInArray.tags, ...p[verse].tags }
    }

    arr.sort((a: any, b: any) => Number(b.date) - Number(a.date))

    return arr
  }, [])

// Complex selector for TagScreen - extracts all data related to a tag
export const makeTagDataSelector = () =>
  createSelector(
    [
      selectHighlights,
      selectNotes,
      selectLinks,
      selectStudies,
      selectNaves,
      selectWords,
      selectStrongsGrec,
      selectStrongsHebreu,
      (_: RootState, tag: Tag) => tag,
    ],
    (highlights, notes, links, studies, naves, words, strongsGrec, strongsHebreu, tag) => {
      return {
        highlights: tag.highlights
          ? sortVersesByDate(
              Object.keys(tag.highlights).reduce<Record<string, Highlight>>(
                (acc, id) => ({
                  ...acc,
                  ...(highlights[id] && { [id]: highlights[id] }),
                }),
                {}
              )
            )
          : [],
        notes: tag.notes
          ? Object.keys(tag.notes)
              .map(
                id =>
                  ({ id, reference: '', ...notes[id] }) as Note & { id: string; reference: string }
              )
              .filter(c => c && c.date)
          : [],
        links: tag.links
          ? Object.keys(tag.links)
              .map(id => ({ id, ...links[id] }) as Link & { id: string })
              .filter(c => c && c.date)
          : [],
        studies: tag.studies
          ? Object.keys(tag.studies)
              .map(id => studies[id])
              .filter(c => c)
          : [],
        naves: tag.naves
          ? Object.keys(tag.naves)
              .map(id => (naves as Record<string, any>)[id])
              .filter(c => c)
          : [],
        words: tag.words
          ? Object.keys(tag.words)
              .map(id => (words as Record<string, any>)[id])
              .filter(c => c)
          : [],
        strongsGrec: tag.strongsGrec
          ? Object.keys(tag.strongsGrec)
              .map(id => (strongsGrec as Record<string, any>)[id])
              .filter(c => c)
          : [],
        strongsHebreu: tag.strongsHebreu
          ? Object.keys(tag.strongsHebreu)
              .map(id => (strongsHebreu as Record<string, any>)[id])
              .filter(c => c)
          : [],
      }
    }
  )

// Selector for note by id (for BibleNoteModal)
export const makeNoteByIdSelector = () =>
  createSelector(
    [selectNotes, (_: RootState, noteId: string) => noteId],
    (notes, noteId): (Note & { id: string }) | null => {
      if (notes[noteId]) {
        return {
          id: noteId,
          ...notes[noteId],
        }
      }
      return null
    }
  )

// Selector for link by id (for BibleLinkModal)
export const makeLinkByIdSelector = () =>
  createSelector(
    [selectLinks, (_: RootState, linkId: string) => linkId],
    (links, linkId): (Link & { id: string }) | null => {
      if (links[linkId]) {
        return {
          id: linkId,
          ...links[linkId],
        }
      }
      return null
    }
  )

// Selector for all links (for LinksScreen) - returns LinksObj
export const selectAllLinks = createSelector([selectLinks], links => {
  return links || {}
})

// Selector for Strong tags
export const makeStrongTagsSelector = () =>
  createSelector(
    [
      selectStrongsGrec,
      selectStrongsHebreu,
      (_: RootState, code: string, isGreek: boolean) => ({ code, isGreek }),
    ],
    (strongsGrec, strongsHebreu, { code, isGreek }) => {
      const strongs = isGreek ? strongsGrec : strongsHebreu
      return (strongs as Record<string, { tags?: Record<string, any> }>)[code]?.tags
    }
  )

// Selector for dictionary word tags
export const makeWordTagsSelector = () =>
  createSelector(
    [selectWords, (_: RootState, word: string) => word],
    (words, word) => (words as Record<string, { tags?: Record<string, any> }>)[word]?.tags
  )

// Selector for nave tags
export const makeNaveTagsSelector = () =>
  createSelector(
    [selectNaves, (_: RootState, nameLower: string) => nameLower],
    (naves, nameLower) => (naves as Record<string, { tags?: Record<string, any> }>)[nameLower]?.tags
  )
