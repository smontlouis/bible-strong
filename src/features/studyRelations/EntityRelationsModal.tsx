import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref } from 'react'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import StudyRelationList from './StudyRelationList'
import { getEndpointFallbackLabel, type RelationEndpoint } from './domain'
import { useOpenRelationEndpoint } from './useOpenRelationEndpoint'

type Props = {
  ref?: Ref<BottomSheetModal | null>
  endpoint: RelationEndpoint | null
  onCreateRelation?: () => void
}

const EntityRelationsModal = ({ ref, endpoint, onCreateRelation }: Props) => {
  const openEndpoint = useOpenRelationEndpoint()
  const title = endpoint ? getEndpointFallbackLabel(endpoint) : 'Relations'

  return (
    <Modal.Body
      ref={ref}
      snapPoints={['60%']}
      headerComponent={
        <ModalHeader
          title={title}
          subTitle={endpoint ? 'Relations' : undefined}
          rightComponent={
            endpoint && onCreateRelation ? (
              <TouchableBox
                onPress={onCreateRelation}
                alignSelf="center"
                mr={20}
                borderRadius={18}
                bg="primary"
                width={24}
                height={24}
                alignItems="center"
                justifyContent="center"
              >
                <FeatherIcon name="plus" size={14} color="reverse" />
              </TouchableBox>
            ) : undefined
          }
        />
      }
    >
      <Box px={20} py={10}>
        {endpoint ? (
          <StudyRelationList
            endpoint={endpoint}
            onOpenEndpoint={openEndpoint}
            onCreateRelation={onCreateRelation}
            showCreateButton={false}
            showEmptyState
          />
        ) : null}
      </Box>
    </Modal.Body>
  )
}

export default EntityRelationsModal
