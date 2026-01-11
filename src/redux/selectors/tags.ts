import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '~redux/modules/reducer'
import { Tag } from '~common/types'

const selectTags = (state: RootState) => state.user.bible.tags

export const sortedTagsSelector = createSelector([selectTags], (tags): Tag[] =>
  Object.values(tags)
    .filter(t => t.id)
    .sort((a, b) => a.name.localeCompare(b.name))
)

// Selector factory for a single tag by id
export const makeTagByIdSelector = () =>
  createSelector(
    [selectTags, (_: RootState, tagId: string) => tagId],
    (tags, tagId): Tag | undefined => tags[tagId]
  )
