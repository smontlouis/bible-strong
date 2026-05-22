import { useRef } from 'react'
import { useSelector } from 'react-redux'
import type { RelationChip } from '~common/TagList'
import type { RootState } from '~redux/modules/reducer'
import { makeStudyRelationDisplayModelsSelector } from '~redux/selectors/bible'
import type { RelationEndpoint } from './domain'
import { useOpenRelationEndpoint } from './useOpenRelationEndpoint'

export const useRelationChips = (endpoint: RelationEndpoint | null) => {
  const selectDisplayModelsRef = useRef(makeStudyRelationDisplayModelsSelector())
  const openRelationEndpoint = useOpenRelationEndpoint()
  const relationModels = useSelector((state: RootState) =>
    endpoint ? selectDisplayModelsRef.current(state, endpoint) : []
  )

  const relationList: RelationChip[] = relationModels.map(model => ({
    id: model.relation.id,
    label: model.targetLabel,
    onPress: () => openRelationEndpoint(model.targetEndpoint),
  }))

  return { relationModels, relationList, openRelationEndpoint }
}
