import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { makeTagDataSelector } from '~redux/selectors/bible'
import { makeTagByIdSelector } from '~redux/selectors/tags'

export const useTagData = (tagId: string) => {
  const selectTagById = makeTagByIdSelector()
  const selectTagData = makeTagDataSelector()

  const tag = useSelector((state: RootState) => selectTagById(state, tagId))

  const tagData = useSelector((state: RootState) =>
    tag
      ? selectTagData(state, tag)
      : {
          highlights: [],
          notes: [],
          links: [],
          studies: [],
          naves: [],
          words: [],
          strongsGrec: [],
          strongsHebreu: [],
          wordAnnotations: [],
        }
  )

  return { tag, ...tagData }
}
