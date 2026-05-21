import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref } from 'react'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import StudyRelationList from '~features/studyRelations/StudyRelationList'
import { useOpenRelationEndpoint } from '~features/studyRelations/useOpenRelationEndpoint'
import verseToReference from '~helpers/verseToReference'

type Props = {
  ref?: Ref<BottomSheetModal | null>
  verseKey: string | null
  onCreateRelation?: () => void
}

const VerseStudyRelationsModal = ({ ref, verseKey, onCreateRelation }: Props) => {
  const openEndpoint = useOpenRelationEndpoint()
  const endpoint = verseKey
    ? {
        type: 'verse' as const,
        verseKeys: [verseKey],
        label: verseToReference({ [verseKey]: true }),
      }
    : null

  return (
    <Modal.Body
      ref={ref}
      snapPoints={['60%']}
      headerComponent={
        <ModalHeader
          title={endpoint?.label || 'Relations'}
          subTitle={endpoint ? 'Relations' : undefined}
          rightComponent={
            endpoint && onCreateRelation ? (
              <TouchableBox
                onPress={onCreateRelation}
                alignSelf="center"
                mr={20}
                borderRadius={18}
                bg="primary"
                width={36}
                height={36}
                alignItems="center"
                justifyContent="center"
              >
                <FeatherIcon name="plus" size={18} color="reverse" />
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

export default VerseStudyRelationsModal
