import { useSelector } from 'react-redux'
import EntityChipList from '~common/EntityChipList'
import { createStrongEndpoint } from '~features/studyRelations/endpoints'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import type { RootState } from '~redux/modules/reducer'
import { makeStrongTagsSelector } from '~redux/selectors/bible'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'

export default function StrongEntryMetadata({ entry }: { entry: StrongLexiconEntry }) {
  const selectStrongTags = makeStrongTagsSelector()
  const tags = useSelector((state: RootState) =>
    selectStrongTags(state, entry.stepCode, entry.language === 'greek')
  )
  const strongEndpoint = createStrongEndpoint({
    language: entry.language,
    code: entry.stepCode,
    labelFallback: entry.gloss,
    originalWord: entry.original,
  })
  const relationCount = useRelationCount(strongEndpoint)
  const openEntityRelations = useOpenEntityRelations()
  return (
    <EntityChipList
      tags={tags}
      relationCount={relationCount}
      onRelationPress={() => openEntityRelations(strongEndpoint)}
    />
  )
}
