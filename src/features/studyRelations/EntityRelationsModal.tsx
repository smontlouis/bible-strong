import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref } from 'react'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import CreateEntityRelationModal from './CreateEntityRelationModal'
import StudyRelationList from './StudyRelationList'
import { getEndpointFallbackLabel, type RelationEndpoint } from './domain'
import { useOpenRelationEndpoint } from './useOpenRelationEndpoint'

type Props = {
  ref?: Ref<BottomSheetModal | null>
  endpoint: RelationEndpoint | null
}

const EntityRelationsModal = ({ ref, endpoint }: Props) => {
  const openEndpoint = useOpenRelationEndpoint()
  const createRelationModal = useBottomSheetModal()
  const isSingleVerseEndpoint = endpoint?.type === 'verse' && endpoint.verseKeys.length === 1
  const endpointLabel = endpoint ? getEndpointFallbackLabel(endpoint) : ''
  const title = isSingleVerseEndpoint ? 'Relations' : endpointLabel || 'Relations'
  const subTitle = isSingleVerseEndpoint ? endpointLabel : endpoint ? 'Relations' : undefined

  return (
    <>
      <Modal.Body
        ref={ref}
        enableDynamicSizing
        headerComponent={
          <ModalHeader
            title={title}
            subTitle={subTitle}
            rightComponent={
              endpoint ? (
                <TouchableBox
                  onPress={() => createRelationModal.open()}
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
        <Box pl={5} pr={20}>
          {endpoint ? (
            <StudyRelationList
              endpoint={endpoint}
              onOpenEndpoint={openEndpoint}
              showEmptyState
              includeStartingVerseRelations={isSingleVerseEndpoint}
            />
          ) : null}
        </Box>
      </Modal.Body>
      <CreateEntityRelationModal
        ref={createRelationModal.getRef()}
        sourceEndpoint={endpoint}
        onCreated={() => createRelationModal.close()}
      />
    </>
  )
}

export default EntityRelationsModal
