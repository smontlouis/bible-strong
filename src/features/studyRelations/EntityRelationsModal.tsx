import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref } from 'react'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box from '~common/ui/Box'
import StudyRelationList from './StudyRelationList'
import type { RelationEndpoint } from './domain'
import { useOpenRelationEndpoint } from './useOpenRelationEndpoint'

type Props = {
  ref?: Ref<BottomSheetModal | null>
  endpoint: RelationEndpoint | null
  onCreateRelation?: () => void
}

const EntityRelationsModal = ({ ref, endpoint, onCreateRelation }: Props) => {
  const openEndpoint = useOpenRelationEndpoint()

  return (
    <Modal.Body ref={ref} snapPoints={['60%']} headerComponent={<ModalHeader title="Relations" />}>
      <Box px={20} py={10}>
        {endpoint ? (
          <StudyRelationList
            endpoint={endpoint}
            onOpenEndpoint={openEndpoint}
            onCreateRelation={onCreateRelation}
            showEmptyState
          />
        ) : null}
      </Box>
    </Modal.Body>
  )
}

export default EntityRelationsModal
