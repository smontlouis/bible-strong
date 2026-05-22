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
  StudyRelationsObj,
  RelationEndpoint,
  StudyRelation,
} from '~redux/modules/user'
import { WordAnnotation } from '~redux/modules/user/wordAnnotations'
import { Tag, CurrentTheme, TagsObj } from '~common/types'
import { VersionCode } from '~state/tabs'
import {
  getRelationDisplayModel,
  getEndpointFallbackLabel,
  endpointIdentity,
  relationIncludesEndpoint,
  relationIncludesVerseKey,
} from '~features/studyRelations/domain'

type TaggedEntity = { id: string | number; title: string; tags?: TagsObj }
type HighlightVerseGroup = {
  date: number
  color: string
  verseIds: { Livre: number; Chapitre: number; Verset: number; Texte: string }[]
  stringIds: Record<string, true>
  tags: TagsObj
}

const isTaggedEntity = (entity: unknown): entity is TaggedEntity =>
  !!entity &&
  typeof entity === 'object' &&
  'id' in entity &&
  'title' in entity &&
  (typeof (entity as { id: unknown }).id === 'string' ||
    typeof (entity as { id: unknown }).id === 'number') &&
  typeof (entity as { title: unknown }).title === 'string'

// Base selectors - private
// All selectors use nullish coalescing to prevent crashes when state is undefined
// (e.g., during Redux rehydration or state corruption)
const selectHighlights = (state: RootState) => state.user.bible.highlights ?? {}
export const selectLinks = (state: RootState) => state.user.bible.links ?? {}
export const selectStudyRelations = (state: RootState) => state.user.bible.studyRelations ?? {}
const selectStudies = (state: RootState) => state.user.bible.studies ?? {}
const selectNaves = (state: RootState) => state.user.bible.naves ?? {}
const selectWords = (state: RootState) => state.user.bible.words ?? {}
const selectStrongsGrec = (state: RootState) => state.user.bible.strongsGrec ?? {}
const selectStrongsHebreu = (state: RootState) => state.user.bible.strongsHebreu ?? {}
const selectColors = (state: RootState) => state.user.bible.settings?.colors ?? {}

// Base selectors - exported for use by other selectors and components
export const selectNotes = (state: RootState) => state.user.bible.notes ?? {}
export const selectWordAnnotations = (state: RootState) => state.user.bible.wordAnnotations ?? {}

// Selector factory for highlights by chapter
// Usage: const selectHighlightsByChapter = makeHighlightsByChapterSelector()
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

export const makeStudyRelationsByChapterSelector = () =>
  createSelector(
    [
      selectStudyRelations,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (studyRelations, prefix): StudyRelationsObj => {
      const result: StudyRelationsObj = {}
      for (const [id, relation] of Object.entries(studyRelations)) {
        if (
          relation.endpoints.some(
            endpoint =>
              endpoint.type === 'verse' && endpoint.verseKeys.some(key => key.startsWith(prefix))
          )
        ) {
          result[id] = relation
        }
      }
      return result
    }
  )

export const makeStudyRelationsForEndpointSelector = () =>
  createSelector(
    [selectStudyRelations, (_: RootState, endpoint: RelationEndpoint) => endpoint],
    (studyRelations, endpoint): StudyRelation[] =>
      Object.values(studyRelations)
        .filter(relation => relationIncludesEndpoint(relation, endpoint))
        .sort((a, b) => b.updatedAt - a.updatedAt)
  )

export const makeStudyRelationDisplayModelsSelector = () =>
  createSelector(
    [
      selectStudyRelations,
      selectNotes,
      selectStudies,
      selectStrongsGrec,
      selectStrongsHebreu,
      (_: RootState, endpoint: RelationEndpoint) => endpoint,
    ],
    (studyRelations, notes, studies, strongsGrec, strongsHebreu, endpoint) =>
      Object.values(studyRelations)
        .filter(relation => relationIncludesEndpoint(relation, endpoint))
        .map(relation =>
          getRelationDisplayModel(relation, endpoint, {
            notes,
            studies,
            strongsGrec,
            strongsHebreu,
          })
        )
        .filter((model): model is NonNullable<typeof model> => Boolean(model))
        .sort((a, b) => b.relation.updatedAt - a.relation.updatedAt)
  )

export const makeStudyRelationDisplaySectionsForVerseKeySelector = () =>
  createSelector(
    [
      selectStudyRelations,
      selectNotes,
      selectStudies,
      selectStrongsGrec,
      selectStrongsHebreu,
      (_: RootState, verseKey: string) => verseKey,
    ],
    (studyRelations, notes, studies, strongsGrec, strongsHebreu, verseKey) => {
      const sections = new Map<
        string,
        {
          id: string
          title: string
          data: NonNullable<ReturnType<typeof getRelationDisplayModel>>[]
        }
      >()

      for (const relation of Object.values(studyRelations)) {
        if (!relationIncludesVerseKey(relation, verseKey)) continue

        const endpoint = relation.endpoints.find(
          relationEndpoint =>
            relationEndpoint.type === 'verse' && relationEndpoint.verseKeys.includes(verseKey)
        )
        if (!endpoint) continue

        const model = getRelationDisplayModel(relation, endpoint, {
          notes,
          studies,
          strongsGrec,
          strongsHebreu,
        })
        if (!model) continue

        const id = endpointIdentity(endpoint)
        const section = sections.get(id) || {
          id,
          title: getEndpointFallbackLabel(endpoint),
          data: [],
        }
        section.data.push(model)
        sections.set(id, section)
      }

      return [...sections.values()]
        .map(section => ({
          ...section,
          data: section.data.sort((a, b) => b.relation.updatedAt - a.relation.updatedAt),
        }))
        .sort((a, b) => b.data[0].relation.updatedAt - a.data[0].relation.updatedAt)
    }
  )

export const makeStudyRelationIndicatorsByChapterSelector = () =>
  createSelector(
    [
      selectStudyRelations,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (studyRelations, prefix): Record<string, number> => {
      const result: Record<string, number> = {}
      for (const relation of Object.values(studyRelations)) {
        for (const endpoint of relation.endpoints) {
          if (endpoint.type !== 'verse') continue
          for (const verseKey of endpoint.verseKeys) {
            if (verseKey.startsWith(prefix) && relationIncludesVerseKey(relation, verseKey)) {
              const verse = verseKey.split('-')[2]
              result[verse] = (result[verse] || 0) + 1
            }
          }
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

        // Check if each range belongs to this chapter
        const hasRangeInChapter = annotation.ranges.some(range => range.verseKey.startsWith(prefix))

        if (hasRangeInChapter) {
          result[annotationId] = annotation
        }
      }
      return result
    }
  )

// Selector for checking if a selected verse is highlighted
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
    [selectHighlights, (_: RootState, tagHighlights: object | undefined) => tagHighlights],
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
      (_: RootState, tagWordAnnotations: object | undefined) => tagWordAnnotations,
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
  Object.keys(p).reduce<HighlightVerseGroup[]>((arr, verse) => {
    const [Livre, Chapitre, Verset] = verse.split('-').map(Number)
    const formattedVerse = { Livre, Chapitre, Verset, Texte: '' }

    if (!arr.find(a => a.date === p[verse].date)) {
      arr.push({
        date: p[verse].date,
        color: p[verse].color,
        verseIds: [],
        stringIds: {},
        tags: {},
      })
    }

    const dateInArray = arr.find(a => a.date === p[verse].date)
    if (dateInArray) {
      dateInArray.stringIds[verse] = true
      dateInArray.verseIds.push(formattedVerse)
      dateInArray.verseIds.sort((a, b) => Number(a.Verset) - Number(b.Verset))
      dateInArray.tags = { ...dateInArray.tags, ...p[verse].tags }
    }

    arr.sort((a, b) => Number(b.date) - Number(a.date))

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
              .map(id => naves[id])
              .filter(isTaggedEntity)
          : [],
        words: tag.words
          ? Object.keys(tag.words)
              .map(id => words[id])
              .filter(isTaggedEntity)
          : [],
        strongsGrec: tag.strongsGrec
          ? Object.keys(tag.strongsGrec)
              .map(id => strongsGrec[id])
              .filter(isTaggedEntity)
          : [],
        strongsHebreu: tag.strongsHebreu
          ? Object.keys(tag.strongsHebreu)
              .map(id => strongsHebreu[id])
              .filter(isTaggedEntity)
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

// Selector for available annotation versions (for type filter in HighlightsScreen)
export const selectAvailableAnnotationVersions = createSelector(
  [selectWordAnnotations],
  (annotations): string[] => {
    const versions = new Set<string>()
    for (const id in annotations) {
      versions.add(annotations[id].version)
    }
    return Array.from(versions).sort()
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
      return (strongs as Record<string, TaggedEntity>)[code]?.tags
    }
  )

// Selector for dictionary word tags
export const makeWordTagsSelector = () =>
  createSelector(
    [selectWords, (_: RootState, word: string) => word],
    (words, word) => (words as Record<string, TaggedEntity>)[word]?.tags
  )

// Selector for nave tags
export const makeNaveTagsSelector = () =>
  createSelector(
    [selectNaves, (_: RootState, nameLower: string) => nameLower],
    (naves, nameLower) => (naves as Record<string, TaggedEntity>)[nameLower]?.tags
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
      (_: RootState, verseKey: string, currentVersion?: string) => ({
        verseKey,
        currentVersion,
      }),
    ],
    (highlights, wordAnnotations, notes, links, { verseKey, currentVersion }): TaggedItem[] => {
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

      // Word annotations on this verse (filtered by version if provided)
      Object.entries(wordAnnotations).forEach(([id, annotation]) => {
        // Filter by version if specified
        if (currentVersion && annotation.version !== currentVersion) return
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

// Selector factory to check if a verse has tagged items
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
      (_: RootState, bookNumber: number, chapter: number, currentVersion: string) => ({
        bookNumber,
        chapter,
        currentVersion,
      }),
    ],
    (
      highlights,
      wordAnnotations,
      notes,
      links,
      { bookNumber, chapter, currentVersion }
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
      // Filter by version - annotations from other versions are shown in VersionAnnotationIndicator
      for (const id in wordAnnotations) {
        const annotation = wordAnnotations[id]
        if (annotation.version !== currentVersion) continue
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

// Type for notes on a specific verse
export type NoteItem = {
  id: string
  title: string
  description: string
  date: number
  tags?: TagsObj
  isAnnotationNote: boolean
  // For annotation notes
  annotationId?: string
  annotationText?: string
  annotationVerseKey?: string
  version?: VersionCode
}

// Selector factory for getting all notes on a specific verse
export const makeNotesForVerseSelector = () =>
  createSelector(
    [selectNotes, selectWordAnnotations, (_: RootState, verseKey: string) => verseKey],
    (notes, wordAnnotations, verseKey): NoteItem[] => {
      const items: NoteItem[] = []

      // 1. Regular notes that include this verse
      Object.entries(notes).forEach(([noteKey, note]) => {
        // Skip annotation notes
        if (noteKey.startsWith('annotation:')) return

        // Note keys can be "1-1-1" or "1-1-1/1-1-2" for verse ranges
        const versesInKey = noteKey.split('/')
        if (versesInKey.includes(verseKey)) {
          items.push({
            id: noteKey,
            title: note.title,
            description: note.description,
            date: note.date,
            tags: note.tags,
            isAnnotationNote: false,
          })
        }
      })

      // 2. Annotation notes on this verse
      Object.entries(wordAnnotations).forEach(([annotationId, annotation]) => {
        const isOnVerse = annotation.ranges.some(r => r.verseKey === verseKey)
        if (isOnVerse && annotation.noteId) {
          const note = notes[annotation.noteId]
          if (note) {
            items.push({
              id: annotation.noteId,
              title: note.title,
              description: note.description,
              date: note.date,
              tags: note.tags,
              isAnnotationNote: true,
              annotationId,
              annotationText: annotation.ranges.map(r => r.text).join(' '),
              annotationVerseKey: annotation.ranges[0]?.verseKey,
              version: annotation.version,
            })
          }
        }
      })

      // Sort by date (newest first)
      return items.sort((a, b) => b.date - a.date)
    }
  )

// Selector factory for note by key (replaces makeCurrentNoteSelector in multiple files)
// Usage: const selectNoteByKey = makeNoteByKeySelector()
export const makeNoteByKeySelector = () =>
  createSelector(
    [selectNotes, (_: RootState, noteKey: string) => noteKey],
    (notes, noteKey): (Note & { id: string }) | null => {
      if (noteKey && notes[noteKey]) {
        return {
          id: noteKey,
          ...notes[noteKey],
        }
      }
      return null
    }
  )

// Selector factory for word annotation by id
// Usage: const selectAnnotationById = makeWordAnnotationByIdSelector()
export const makeWordAnnotationByIdSelector = () =>
  createSelector(
    [selectWordAnnotations, (_: RootState, annotationId: string) => annotationId],
    (wordAnnotations, annotationId): WordAnnotation | null => {
      return wordAnnotations[annotationId] || null
    }
  )
