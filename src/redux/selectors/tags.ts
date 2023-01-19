import { RootState } from '~redux/modules/reducer'

export const sortedTagsSelector = (state: RootState) =>
  Object.values(state.user.bible.tags)
    .filter(t => t.id)
    .sort((a, b) => a.name.localeCompare(b.name))
