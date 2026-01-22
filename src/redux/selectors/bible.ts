import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '~redux/modules/reducer'
import {
  HighlightsObj,
  NotesObj,
  LinksObj,
  Note,
  Highlight,
  Link,
  WordAnnotationsObj,
} from '~redux/modules/user'
import { WordAnnotation } from '~redux/modules/user/wordAnnotations'
import { Tag, CurrentTheme, TagsObj } from '~common/types'
import { VersionCode } from '~state/tabs'

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
const selectWordAnnotations = (state: RootState) => state.user.bible.wordAnnotations

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

// Selector factory for word annotations by chapter and version
// Note: Word annotations are filtered by version since they're version-specific
export const makeWordAnnotationsByChapterSelector = () =>
  createSelector(
    [
      selectWordAnnotations,
      (_: RootState, bookNumber: number, chapter: number, version: string) => ({
        prefix: `${bookNumber}-${chapter}-`,
        version,
      }),
    ],
    (wordAnnotations, { prefix, version }): WordAnnotationsObj => {
      const result: WordAnnotationsObj = {}
      // Filter annotations by version and chapter
      for (const annotationId in wordAnnotations) {
        const annotation = wordAnnotations[annotationId]
        // Only include annotations for the current version
        if (annotation.version !== version) continue

        // Check if any range belongs to this chapter
        const hasRangeInChapter = annotation.ranges.some(range => range.verseKey.startsWith(prefix))

        if (hasRangeInChapter) {
          result[annotationId] = annotation
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

// Selector for getting the highlight color of selected verses
// Returns the color key if all selected verses have the same highlight color, null otherwise
export const makeSelectedVerseHighlightColorSelector = () =>
  createSelector(
    [
      selectHighlights,
      (_: RootState, selectedVerses: { [key: string]: boolean }) => selectedVerses,
    ],
    (highlights, selectedVerses): string | null => {
      const verseKeys = Object.keys(selectedVerses)
      if (verseKeys.length === 0) return null

      // Get the colors of all highlighted verses
      const colors = verseKeys
        .map(verse => highlights[verse]?.color)
        .filter((color): color is string => Boolean(color))

      // If no verses are highlighted, return null
      if (colors.length === 0) return null

      // If not all selected verses are highlighted, return null
      if (colors.length !== verseKeys.length) return null

      // Check if all colors are the same
      const firstColor = colors[0]
      const allSameColor = colors.every(color => color === firstColor)

      return allSameColor ? firstColor : null
    }
  )

// Selector factory for colors by theme
export const makeColorsByThemeSelector = () =>
  createSelector(
    [selectColors, (_: RootState, theme: CurrentTheme) => theme],
    (colors, theme) => colors[theme]
  )

// Selector factory for counting grouped highlights (by unique date) for a tag
export const makeGroupedHighlightsCountSelector = () =>
  createSelector(
    [selectHighlights, (_: RootState, tagHighlights: Object | undefined) => tagHighlights],
    (highlights, tagHighlights): number => {
      if (!tagHighlights) return 0
      const uniqueDates = new Set<number>()
      for (const id of Object.keys(tagHighlights)) {
        const highlight = highlights[id]
        if (highlight?.date) {
          uniqueDates.add(highlight.date)
        }
      }
      return uniqueDates.size
    }
  )

// Selector factory for counting grouped word annotations (by unique date) for a tag
export const makeGroupedWordAnnotationsCountSelector = () =>
  createSelector(
    [
      selectWordAnnotations,
      (_: RootState, tagWordAnnotations: Object | undefined) => tagWordAnnotations,
    ],
    (wordAnnotations, tagWordAnnotations): number => {
      if (!tagWordAnnotations) return 0
      const uniqueDates = new Set<number>()
      for (const id of Object.keys(tagWordAnnotations)) {
        const annotation = wordAnnotations[id]
        if (annotation?.date) {
          uniqueDates.add(annotation.date)
        }
      }
      return uniqueDates.size
    }
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

// Helper function for sorting word annotations by date (for TagScreen)
const sortWordAnnotationsByDate = (annotations: Record<string, WordAnnotation>) =>
  Object.entries(annotations)
    .map(([id, annotation]) => ({
      id,
      date: annotation.date,
      color: annotation.color,
      type: annotation.type,
      version: annotation.version,
      text: annotation.ranges[0]?.text || '',
      verseKey: annotation.ranges[0]?.verseKey || '',
      tags: annotation.tags,
    }))
    .sort((a, b) => b.date - a.date)

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
      selectWordAnnotations,
      (_: RootState, tag: Tag) => tag,
    ],
    (
      highlights,
      notes,
      links,
      studies,
      naves,
      words,
      strongsGrec,
      strongsHebreu,
      wordAnnotations,
      tag
    ) => {
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
        wordAnnotations: tag.wordAnnotations
          ? sortWordAnnotationsByDate(
              Object.keys(tag.wordAnnotations).reduce<Record<string, WordAnnotation>>(
                (acc, id) => ({
                  ...acc,
                  ...(wordAnnotations[id] && { [id]: wordAnnotations[id] }),
                }),
                {}
              )
            )
          : [],
      }
    }
  )

// Type for grouped word annotations (for HighlightsScreen)
export type GroupedWordAnnotation = {
  id: string
  date: number
  color: string
  type: 'background' | 'underline' | 'circle'
  version: string
  text: string
  verseKey: string
  tags?: Record<string, { id: string; name: string }>
}

// Selector for all word annotations sorted by date (for HighlightsScreen)
export const makeAllWordAnnotationsSelector = () =>
  createSelector([selectWordAnnotations], (wordAnnotations): GroupedWordAnnotation[] => {
    return Object.entries(wordAnnotations)
      .map(([id, annotation]) => ({
        id,
        date: annotation.date,
        color: annotation.color,
        type: annotation.type,
        version: annotation.version,
        text: annotation.ranges[0]?.text || '',
        verseKey: annotation.ranges[0]?.verseKey || '',
        tags: annotation.tags,
      }))
      .sort((a, b) => b.date - a.date)
      .slice(0, 100) // Limit to 100 items like highlights
  })

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

// Type for cross-version annotations per verse
export type CrossVersionAnnotation = {
  version: VersionCode
  count: number
}

// Selector factory for finding word annotations in OTHER versions
// Used to show indicators when viewing one version but annotations exist in another
export const makeWordAnnotationsInOtherVersionsSelector = () =>
  createSelector(
    [
      selectWordAnnotations,
      (_: RootState, bookNumber: number, chapter: number, currentVersion: string) => ({
        prefix: `${bookNumber}-${chapter}-`,
        currentVersion,
      }),
    ],
    (wordAnnotations, { prefix, currentVersion }): Record<string, CrossVersionAnnotation[]> => {
      const result: Record<string, CrossVersionAnnotation[]> = {}

      for (const annotationId in wordAnnotations) {
        const annotation = wordAnnotations[annotationId]
        // Exclude annotations from the current version
        if (annotation.version === currentVersion) continue

        for (const range of annotation.ranges) {
          if (range.verseKey.startsWith(prefix)) {
            if (!result[range.verseKey]) {
              result[range.verseKey] = []
            }
            let versionEntry = result[range.verseKey].find(v => v.version === annotation.version)
            if (!versionEntry) {
              versionEntry = { version: annotation.version, count: 0 }
              result[range.verseKey].push(versionEntry!)
            }
            versionEntry!.count++
          }
        }
      }

      return result
    }
  )

// Types for tagged items on a verse
export type TaggedItemHighlight = {
  type: 'highlight'
  data: Highlight
  verseKey: string
}

export type TaggedItemAnnotation = {
  type: 'annotation'
  data: WordAnnotation & { id: string }
}

export type TaggedItemNote = {
  type: 'note'
  data: Note & { id: string }
  verseKey: string
}

export type TaggedItemLink = {
  type: 'link'
  data: Link & { id: string }
  verseKey: string
}

export type TaggedItem =
  | TaggedItemHighlight
  | TaggedItemAnnotation
  | TaggedItemNote
  | TaggedItemLink

// Selector factory for getting all tagged items for a specific verse
export const makeTaggedItemsForVerseSelector = () =>
  createSelector(
    [
      selectHighlights,
      selectWordAnnotations,
      selectNotes,
      selectLinks,
      (_: RootState, verseKey: string) => verseKey,
    ],
    (highlights, wordAnnotations, notes, links, verseKey): TaggedItem[] => {
      const items: TaggedItem[] = []
      const [bookStr, chapterStr, verseStr] = verseKey.split('-')
      const book = parseInt(bookStr)
      const chapter = parseInt(chapterStr)
      const verse = parseInt(verseStr)

      // Highlight for this verse
      const highlight = highlights[verseKey]
      if (highlight?.tags && Object.keys(highlight.tags).length > 0) {
        items.push({ type: 'highlight', data: highlight, verseKey })
      }

      // Word annotations on this verse (any version)
      Object.entries(wordAnnotations).forEach(([id, annotation]) => {
        if (annotation.tags && Object.keys(annotation.tags).length > 0) {
          // Check if the annotation is on this verse
          const matchesVerse = annotation.ranges.some(r => {
            const [rBook, rChapter, rVerse] = r.verseKey.split('-').map(Number)
            return rBook === book && rChapter === chapter && rVerse === verse
          })
          if (matchesVerse) {
            items.push({ type: 'annotation', data: { ...annotation, id } })
          }
        }
      })

      // Notes for this verse (check all note keys that include this verse)
      Object.entries(notes).forEach(([noteKey, note]) => {
        // Skip annotation notes
        if (noteKey.startsWith('annotation:')) return

        if (note?.tags && Object.keys(note.tags).length > 0) {
          // Note keys can be "1-1-1" or "1-1-1/1-1-2" for verse ranges
          const versesInKey = noteKey.split('/')
          const matchesVerse = versesInKey.some(vk => vk === verseKey)
          if (matchesVerse) {
            items.push({ type: 'note', data: { ...note, id: noteKey }, verseKey: noteKey })
          }
        }
      })

      // Links for this verse
      Object.entries(links).forEach(([linkKey, link]) => {
        if (link?.tags && Object.keys(link.tags).length > 0) {
          // Link keys can be "1-1-1" or "1-1-1/1-1-2" for verse ranges
          const versesInKey = linkKey.split('/')
          const matchesVerse = versesInKey.some(vk => vk === verseKey)
          if (matchesVerse) {
            items.push({ type: 'link', data: { ...link, id: linkKey }, verseKey: linkKey })
          }
        }
      })

      return items
    }
  )

// Selector factory to check if a verse has any tagged items
export const makeHasTaggedItemsForVerseSelector = () => {
  const taggedItemsSelector = makeTaggedItemsForVerseSelector()
  return createSelector([taggedItemsSelector], (items): boolean => items.length > 0)
}

// Type for tagged verses selector result
export type TaggedVersesInChapterResult = {
  counts: Record<number, number>
  hasNonHighlightTags: Record<number, boolean>
}

// Selector factory for getting verses with tagged items in a chapter
// Returns counts per verse and which verses have non-highlight tags
export const makeTaggedVersesInChapterSelector = () =>
  createSelector(
    [
      selectHighlights,
      selectWordAnnotations,
      selectNotes,
      selectLinks,
      (_: RootState, bookNumber: number, chapter: number) => ({ bookNumber, chapter }),
    ],
    (
      highlights,
      wordAnnotations,
      notes,
      links,
      { bookNumber, chapter }
    ): TaggedVersesInChapterResult => {
      const counts: Record<number, number> = {}
      const hasNonHighlightTags: Record<number, boolean> = {}
      const prefix = `${bookNumber}-${chapter}-`

      // Check highlights (does NOT count for hasNonHighlightTags)
      for (const key in highlights) {
        if (key.startsWith(prefix)) {
          const highlight = highlights[key]
          if (highlight?.tags && Object.keys(highlight.tags).length > 0) {
            const verseNum = parseInt(key.split('-')[2])
            counts[verseNum] = (counts[verseNum] || 0) + 1
          }
        }
      }

      // Check word annotations (COUNTS for hasNonHighlightTags)
      for (const id in wordAnnotations) {
        const annotation = wordAnnotations[id]
        if (annotation.tags && Object.keys(annotation.tags).length > 0) {
          for (const range of annotation.ranges) {
            if (range.verseKey.startsWith(prefix)) {
              const verseNum = parseInt(range.verseKey.split('-')[2])
              counts[verseNum] = (counts[verseNum] || 0) + 1
              hasNonHighlightTags[verseNum] = true
            }
          }
        }
      }

      // Check notes (COUNTS for hasNonHighlightTags)
      for (const noteKey in notes) {
        if (noteKey.startsWith('annotation:')) continue
        const note = notes[noteKey]
        if (note?.tags && Object.keys(note.tags).length > 0) {
          const versesInKey = noteKey.split('/')
          for (const vk of versesInKey) {
            if (vk.startsWith(prefix)) {
              const verseNum = parseInt(vk.split('-')[2])
              counts[verseNum] = (counts[verseNum] || 0) + 1
              hasNonHighlightTags[verseNum] = true
            }
          }
        }
      }

      // Check links (COUNTS for hasNonHighlightTags)
      for (const linkKey in links) {
        const link = links[linkKey]
        if (link?.tags && Object.keys(link.tags).length > 0) {
          const versesInKey = linkKey.split('/')
          for (const vk of versesInKey) {
            if (vk.startsWith(prefix)) {
              const verseNum = parseInt(vk.split('-')[2])
              counts[verseNum] = (counts[verseNum] || 0) + 1
              hasNonHighlightTags[verseNum] = true
            }
          }
        }
      }

      return { counts, hasNonHighlightTags }
    }
  )
