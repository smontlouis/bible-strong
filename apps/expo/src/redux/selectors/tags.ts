import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '~redux/modules/reducer'
import { Tag } from '~common/types'
import { buildTagListRows } from '~features/entityListQuery/tagListQuery'

const selectTags = (state: RootState) => state.user.bible.tags
const selectHighlights = (state: RootState) => state.user.bible.highlights
const selectNotes = (state: RootState) => state.user.bible.notes
const selectLinks = (state: RootState) => state.user.bible.links
const selectStudies = (state: RootState) => state.user.bible.studies
const selectStrongsHebreu = (state: RootState) => state.user.bible.strongsHebreu
const selectStrongsGrec = (state: RootState) => state.user.bible.strongsGrec
const selectWords = (state: RootState) => state.user.bible.words
const selectNaves = (state: RootState) => state.user.bible.naves
const selectWordAnnotations = (state: RootState) => state.user.bible.wordAnnotations

export const sortedTagsSelector = createSelector([selectTags], (tags): Tag[] =>
  Object.values(tags)
    .filter(t => t.id)
    .sort((a, b) => a.name.localeCompare(b.name))
)

export const selectTagListRows = createSelector(
  [
    selectTags,
    selectHighlights,
    selectNotes,
    selectLinks,
    selectStudies,
    selectStrongsHebreu,
    selectStrongsGrec,
    selectWords,
    selectNaves,
    selectWordAnnotations,
  ],
  (
    tags,
    highlights,
    notes,
    links,
    studies,
    strongsHebreu,
    strongsGrec,
    words,
    naves,
    wordAnnotations
  ) =>
    buildTagListRows(Object.values(tags), {
      highlights,
      notes,
      links,
      studies,
      strongsHebreu,
      strongsGrec,
      words,
      naves,
      wordAnnotations,
    })
)

// Selector factory for a single tag by id
export const makeTagByIdSelector = () =>
  createSelector(
    [selectTags, (_: RootState, tagId: string) => tagId],
    (tags, tagId): Tag | undefined => tags[tagId]
  )
