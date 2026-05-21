import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref } from 'react'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box from '~common/ui/Box'
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
      headerComponent={<ModalHeader title="Relations d’étude" />}
    >
      <Box px={20} py={10}>
        {endpoint ? (
          <StudyRelationList
            endpoint={endpoint}
            onOpenEndpoint={openEndpoint}
            onCreateRelation={onCreateRelation}
          />
        ) : null}
      </Box>
    </Modal.Body>
  )
}

export default VerseStudyRelationsModal
