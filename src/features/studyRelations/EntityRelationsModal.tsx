import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref } from 'react'
import { useTranslation } from 'react-i18next'
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
  onOpenEndpoint?: (endpoint: RelationEndpoint) => void
}

const EntityRelationsModal = ({ ref, endpoint, onOpenEndpoint }: Props) => {
  const { t } = useTranslation()
  const defaultOpenEndpoint = useOpenRelationEndpoint()
  const openEndpoint = onOpenEndpoint || defaultOpenEndpoint
  const createRelationModal = useBottomSheetModal()
  const isSingleVerseEndpoint = endpoint?.type === 'verse' && endpoint.verseKeys.length === 1
  const endpointLabel = endpoint ? getEndpointFallbackLabel(endpoint) : ''
  const title = t('Relations')
  const subTitle = endpointLabel

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
