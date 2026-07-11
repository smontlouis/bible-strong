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
  RelationsObj,
  RelationEndpoint,
  Relation,
} from '~redux/modules/user'
import { WordAnnotation } from '~redux/modules/user/wordAnnotations'
import { Tag, CurrentTheme, TagsObj } from '~common/types'
import { VersionCode } from '~state/tabs'
import verseToReference from '~helpers/verseToReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import {
  getRelationDisplayModel,
  getEndpointFallbackLabel,
  endpointIdentity,
  relationIncludesEndpoint,
  relationIncludesVerseKey,
  createVerseEndpoint,
} from '~features/studyRelations/domain'
import {
  buildGroupedWordAnnotations,
  type GroupedWordAnnotationRow,
} from '~features/entityListQuery/wordAnnotationsQuery'

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

const getRelationEntityEndpoint = (
  relation: Relation,
  type: 'note' | 'externalLink'
): RelationEndpoint | undefined => relation.endpoints.find(endpoint => endpoint.type === type)

const getRelationVerseEndpoint = (relation: Relation): RelationEndpoint | undefined =>
  relation.endpoints.find(endpoint => endpoint.type === 'verse')

export const getRelationVerseKeysForEntity = (
  relations: RelationsObj,
  entityType: 'note' | 'externalLink',
  entityId: string,
  relationType?: 'annotates' | 'externalLink'
): string[] => {
  const verseKeys = new Set<string>()

  Object.values(relations).forEach(relation => {
    if (relationType && relation.type !== relationType) return
    const entityEndpoint = getRelationEntityEndpoint(relation, entityType)
    const verseEndpoint = getRelationVerseEndpoint(relation)
    if (!entityEndpoint || !verseEndpoint || verseEndpoint.type !== 'verse') return

    const matches =
      entityEndpoint.type === 'note'
        ? entityEndpoint.noteId === entityId
        : entityEndpoint.type === 'externalLink'
          ? entityEndpoint.linkId === entityId
          : false

    if (matches) {
      verseEndpoint.verseKeys.forEach(key => verseKeys.add(key))
    }
  })

  return Array.from(verseKeys)
}

const getReferenceFromEntityRelations = (
  relations: RelationsObj,
  entityType: 'note' | 'externalLink',
  entityId: string,
  fallback = ''
): string => {
  const verseKeys = getRelationVerseKeysForEntity(
    relations,
    entityType,
    entityId,
    entityType === 'note' ? 'annotates' : 'externalLink'
  )
  return verseKeys.length
    ? verseToReference(Object.fromEntries(verseKeys.map(key => [key, true])))
    : fallback
}

// Base selectors - private
// All selectors use nullish coalescing to prevent crashes when state is undefined
// (e.g., during Redux rehydration or state corruption)
const selectHighlights = (state: RootState) => state.user.bible.highlights ?? {}
export const selectLinks = (state: RootState) => state.user.bible.links ?? {}
export const selectRelations = (state: RootState) => state.user.bible.relations ?? {}
export const selectRelationIndex = (state: RootState) => state.user.bible.relationIndex ?? {}
export const selectStudyRelations = selectRelations
const selectStudies = (state: RootState) => state.user.bible.studies ?? {}
const selectNaves = (state: RootState) => state.user.bible.naves ?? {}
const selectWords = (state: RootState) => state.user.bible.words ?? {}
const selectStrongsGrec = (state: RootState) => state.user.bible.strongsGrec ?? {}
const selectStrongsHebreu = (state: RootState) => state.user.bible.strongsHebreu ?? {}
const selectColors = (state: RootState) => state.user.bible.settings?.colors ?? {}

// Base selectors - exported for use by other selectors and components
export const selectNotes = (state: RootState) => state.user.bible.notes ?? {}
export const selectWordAnnotations = (state: RootState) => state.user.bible.wordAnnotations ?? {}

export const selectRelationCountsByEndpointIdentity = createSelector(
  [selectRelationIndex],
  (relationIndex): Record<string, number> =>
    Object.entries(relationIndex).reduce(
      (counts, [entityKey, entry]) => ({
        ...counts,
        [entityKey]: entry.totalCount,
      }),
      {} as Record<string, number>
    )
)

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
      selectRelations,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (notes, relations, prefix): NotesObj => {
      const result: NotesObj = {}
      Object.values(relations).forEach(relation => {
        if (relation.kind !== 'system' || relation.type !== 'annotates') return
        const noteEndpoint = getRelationEntityEndpoint(relation, 'note')
        const verseEndpoint = getRelationVerseEndpoint(relation)
        if (noteEndpoint?.type !== 'note' || verseEndpoint?.type !== 'verse') return
        if (!verseEndpoint.verseKeys.some(key => key.startsWith(prefix))) return
        const note = notes[noteEndpoint.noteId]
        if (!note) return

        const verseKey = verseEndpoint.verseKeys.join('/')
        result[`${verseKey}#${noteEndpoint.noteId}`] = {
          ...note,
          id: noteEndpoint.noteId,
        }
      })
      return result
    }
  )

// Selector factory for links by chapter
export const makeLinksByChapterSelector = () =>
  createSelector(
    [
      selectLinks,
      selectRelations,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (links, relations, prefix): LinksObj => {
      const result: LinksObj = {}
      Object.values(relations).forEach(relation => {
        if (relation.kind !== 'system' || relation.type !== 'externalLink') return
        const linkEndpoint = getRelationEntityEndpoint(relation, 'externalLink')
        const verseEndpoint = getRelationVerseEndpoint(relation)
        if (linkEndpoint?.type !== 'externalLink' || verseEndpoint?.type !== 'verse') return
        if (!verseEndpoint.verseKeys.some(key => key.startsWith(prefix))) return
        const link = links[linkEndpoint.linkId]
        if (!link) return

        const verseKey = verseEndpoint.verseKeys.join('/')
        result[`${verseKey}#${linkEndpoint.linkId}`] = {
          ...link,
          id: linkEndpoint.linkId,
        }
      })
      return result
    }
  )

export const makeStudyRelationsByChapterSelector = () =>
  createSelector(
    [
      selectRelations,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (relations, prefix): RelationsObj => {
      const result: RelationsObj = {}
      for (const [id, relation] of Object.entries(relations)) {
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
    [selectRelations, (_: RootState, endpoint: RelationEndpoint) => endpoint],
    (relations, endpoint): Relation[] =>
      Object.values(relations)
        .filter(relation => relationIncludesEndpoint(relation, endpoint))
        .sort((a, b) => b.updatedAt - a.updatedAt)
  )

export const makeStudyRelationDisplayModelsSelector = () =>
  createSelector(
    [
      selectRelations,
      selectNotes,
      selectStudies,
      selectStrongsGrec,
      selectStrongsHebreu,
      selectNaves,
      selectWords,
      selectLinks,
      (_: RootState, endpoint: RelationEndpoint) => endpoint,
    ],
    (relations, notes, studies, strongsGrec, strongsHebreu, naves, words, links, endpoint) =>
      Object.values(relations)
        .filter(relation => relationIncludesEndpoint(relation, endpoint))
        .map(relation =>
          getRelationDisplayModel(relation, endpoint, {
            notes,
            studies,
            links,
            strongsGrec,
            strongsHebreu,
            naves,
            words,
          })
        )
        .filter((model): model is NonNullable<typeof model> => Boolean(model))
        .sort((a, b) => b.relation.updatedAt - a.relation.updatedAt)
  )

export const makeStudyRelationDisplaySectionsForStartingVerseKeySelector = () =>
  createSelector(
    [
      selectRelations,
      selectNotes,
      selectStudies,
      selectStrongsGrec,
      selectStrongsHebreu,
      selectNaves,
      selectWords,
      selectLinks,
      (_: RootState, verseKey: string) => verseKey,
    ],
    (relations, notes, studies, strongsGrec, strongsHebreu, naves, words, links, verseKey) => {
      const sections = new Map<
        string,
        {
          id: string
          title: string
          data: NonNullable<ReturnType<typeof getRelationDisplayModel>>[]
        }
      >()

      for (const relation of Object.values(relations)) {
        const endpoint = relation.endpoints.find(
          relationEndpoint =>
            relationEndpoint.type === 'verse' && relationEndpoint.verseKeys[0] === verseKey
        )
        if (!endpoint) continue

        const model = getRelationDisplayModel(relation, endpoint, {
          notes,
          studies,
          links,
          strongsGrec,
          strongsHebreu,
          naves,
          words,
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
      selectRelationIndex,
      (_: RootState, bookNumber: number, chapter: number) => `${bookNumber}-${chapter}-`,
    ],
    (relationIndex, prefix): Record<string, number> => {
      const result: Record<string, number> = {}
      for (const verseKey of Object.keys(relationIndex)) {
        if (!verseKey.startsWith(`verse:${prefix}`)) continue
        const endpoint = createVerseEndpoint([verseKey.replace('verse:', '')])
        const exactKey = endpointIdentity(endpoint)
        if (verseKey !== exactKey) continue

        const verse = verseKey.replace('verse:', '').split('-')[2]
        const count = relationIndex[verseKey]?.totalCount || 0
        if (verse && count) {
          result[verse] = count
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
          result[annotationId] = {
            ...annotation,
            ranges: annotation.ranges.map(range => ({
              ...range,
              text: '',
            })),
          }
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
      verseKeys: annotation.ranges.map(range => range.verseKey),
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
      selectRelations,
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
      relations,
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
              .map(id => {
                const verseKeys = getRelationVerseKeysForEntity(relations, 'note', id, 'annotates')
                return {
                  id,
                  reference: verseKeys.length
                    ? verseToReference(Object.fromEntries(verseKeys.map(key => [key, true])))
                    : '',
                  verseKeys,
                  ...notes[id],
                } as Note & { id: string; reference: string; verseKeys: string[] }
              })
              .filter(c => c && c.date)
          : [],
        links: tag.links
          ? Object.keys(tag.links)
              .map(id => {
                const verseKeys = getRelationVerseKeysForEntity(
                  relations,
                  'externalLink',
                  id,
                  'externalLink'
                )
                return {
                  id,
                  reference: verseKeys.length
                    ? verseToReference(Object.fromEntries(verseKeys.map(key => [key, true])))
                    : '',
                  verseKeys,
                  ...links[id],
                } as Link & { id: string; reference: string; verseKeys: string[] }
              })
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
export type GroupedWordAnnotation = GroupedWordAnnotationRow

export const makeAllWordAnnotationsSelector = () =>
  createSelector([selectWordAnnotations], buildGroupedWordAnnotations)

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

// Selector for note by id
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

// Selector for link by id
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

export const makeVerseKeysForNoteSelector = () =>
  createSelector(
    [selectRelations, (_: RootState, noteId: string | null | undefined) => noteId],
    (relations, noteId): string[] => {
      if (!noteId) return []
      return getRelationVerseKeysForEntity(relations, 'note', noteId, 'annotates')
    }
  )

export const makeVerseGroupsForNoteSelector = () =>
  createSelector(
    [selectRelations, (_: RootState, noteId: string | null | undefined) => noteId],
    (relations, noteId): string[][] => {
      if (!noteId) return []

      return Object.values(relations)
        .filter(relation => {
          if (relation.kind !== 'system' || relation.type !== 'annotates') return false
          const noteEndpoint = getRelationEntityEndpoint(relation, 'note')
          return noteEndpoint?.type === 'note' && noteEndpoint.noteId === noteId
        })
        .map(relation => {
          const verseEndpoint = getRelationVerseEndpoint(relation)
          return verseEndpoint?.type === 'verse' ? verseEndpoint.verseKeys : []
        })
        .filter(verseKeys => verseKeys.length > 0)
        .sort((a, b) => a[0].localeCompare(b[0]) || a.length - b.length)
    }
  )

export const makeVerseKeysForLinkSelector = () =>
  createSelector(
    [selectRelations, (_: RootState, linkId: string | null | undefined) => linkId],
    (relations, linkId): string[] => {
      if (!linkId) return []
      return getRelationVerseKeysForEntity(relations, 'externalLink', linkId, 'externalLink')
    }
  )

export const makeReferenceForNoteSelector = () =>
  createSelector(
    [selectRelations, (_: RootState, noteId: string | null | undefined) => noteId],
    (relations, noteId): string => {
      if (!noteId) return ''
      return getReferenceFromEntityRelations(relations, 'note', noteId)
    }
  )

export const makeReferenceForLinkSelector = () =>
  createSelector(
    [selectRelations, (_: RootState, linkId: string | null | undefined) => linkId],
    (relations, linkId): string => {
      if (!linkId) return ''
      return getReferenceFromEntityRelations(relations, 'externalLink', linkId)
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

// Selector factory for getting direct verse/highlight tags for a specific verse.
// Tags owned by related notes/links/annotations are exposed through their relation/entity surfaces.
export const makeTaggedItemsForVerseSelector = () =>
  createSelector(
    [selectHighlights, (_: RootState, verseKey: string, _currentVersion?: string) => verseKey],
    (highlights, verseKey): TaggedItem[] => {
      const items: TaggedItem[] = []

      // Highlight for this verse
      const highlight = highlights[verseKey]
      if (highlight?.tags && Object.keys(highlight.tags).length > 0) {
        items.push({ type: 'highlight', data: highlight, verseKey })
      }

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
      (_: RootState, bookNumber: number, chapter: number, currentVersion: string) => ({
        bookNumber,
        chapter,
        currentVersion,
      }),
    ],
    (highlights, { bookNumber, chapter }): TaggedVersesInChapterResult => {
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
  verseKeys?: string[]
  // For annotation notes
  annotationId?: string
  annotationText?: string
  annotationVerseKey?: string
  version?: VersionCode
}

// Selector factory for getting all notes on a specific verse
export const makeNotesForVerseSelector = () =>
  createSelector(
    [
      selectNotes,
      selectWordAnnotations,
      selectRelations,
      (_: RootState, verseKey: string) => verseKey,
    ],
    (notes, wordAnnotations, relations, verseKey): NoteItem[] => {
      const items: NoteItem[] = []

      Object.values(relations).forEach(relation => {
        if (relation.kind !== 'system' || relation.type !== 'annotates') return
        if (!relationIncludesVerseKey(relation, verseKey)) return
        const noteEndpoint = getRelationEntityEndpoint(relation, 'note')
        const verseEndpoint = getRelationVerseEndpoint(relation)
        if (noteEndpoint?.type !== 'note' || noteEndpoint.noteId.startsWith('annotation:')) return
        if (verseEndpoint?.type !== 'verse') return
        const note = notes[noteEndpoint.noteId]
        if (note) {
          items.push({
            id: noteEndpoint.noteId,
            title: getNoteTitle(note, ''),
            description: note.description,
            date: note.date,
            tags: note.tags,
            isAnnotationNote: false,
            verseKeys: verseEndpoint.verseKeys,
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
              title: getNoteTitle(note, ''),
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
