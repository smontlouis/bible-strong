import styled from '@emotion/native'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import React, { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import Modal from '~common/Modal'
import TagList from '~common/TagList'
import { VerseIds } from '~common/types'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { EMPTY_ARRAY } from '~helpers/emptyReferences'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { makeNotesForVerseSelector, NoteItem } from '~redux/selectors/bible'
import { VersionCode } from '~state/tabs'
import AnnotationNoteModal from './AnnotationNoteModal'
import BibleNoteModal from './BibleNoteModal'
import { Chip } from '~common/ui/NewChip'
import ModalHeader from '~common/ModalHeader'

const ItemRow = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const IconContainer = styled.View(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 12,
  backgroundColor: theme.colors.lightGrey,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
}))

interface VerseNotesModalProps {
  verseKey: string | null
}

const NoteItemRow = ({ item, onPress }: { item: NoteItem; onPress: () => void }) => {
  const { t } = useTranslation()

  const label = item.isAnnotationNote ? t('Note (annotation)') : t('Note')

  return (
    <TouchableOpacity onPress={onPress}>
      <ItemRow>
        <IconContainer>
          <FeatherIcon name="file-text" size={18} color="primary" />
        </IconContainer>
        <Box flex>
          <HStack gap={10} alignItems="center">
            <Text bold fontSize={14} numberOfLines={1}>
              {item.title}
            </Text>
            {item.version && <Chip>{item.version}</Chip>}
          </HStack>
          {item.isAnnotationNote && item.annotationText ? (
            <Text fontSize={12} color="grey" numberOfLines={1}>
              {`...${item.annotationText}...`}
            </Text>
          ) : (
            <Text fontSize={12} color="grey" numberOfLines={1}>
              {label}
            </Text>
          )}
          <TagList tags={item.tags} />
        </Box>
        <FeatherIcon name="chevron-right" size={20} color="grey" />
      </ItemRow>
    </TouchableOpacity>
  )
}

const VerseNotesModal = forwardRef<BottomSheetModal, VerseNotesModalProps>(({ verseKey }, ref) => {
  const { t } = useTranslation()

  // State for sub-modals
  const [noteVerses, setNoteVerses] = useState<VerseIds | undefined>()
  const [selectedAnnotationNote, setSelectedAnnotationNote] = useState<{
    annotationId: string
    text: string
    verseKey: string
    noteId: string
    version: VersionCode
  } | null>(null)

  const noteModal = useBottomSheetModal()
  const annotationNoteModal = useBottomSheetModal()

  // Create selector for this verse
  const selectNotesForVerse = makeNotesForVerseSelector()

  const notes = useSelector((state: RootState) =>
    verseKey ? selectNotesForVerse(state, verseKey) : EMPTY_ARRAY
  )

  // Get verse reference for header
  const reference = verseKey ? verseToReference({ [verseKey]: true }) : ''

  const handleOpenNote = (item: NoteItem) => {
    if (item.isAnnotationNote) {
      // Open AnnotationNoteModal
      setSelectedAnnotationNote({
        annotationId: item.annotationId!,
        text: item.annotationText!,
        verseKey: item.annotationVerseKey!,
        noteId: item.id,
        version: item.version!,
      })
      annotationNoteModal.open()
    } else {
      // Open BibleNoteModal
      const verseIds = item.id.split('/').reduce((acc, key) => {
        acc[key] = true
        return acc
      }, {} as VerseIds)
      setNoteVerses(verseIds)
      noteModal.open()
    }
  }

  return (
    <>
      <Modal.Body
        ref={ref}
        snapPoints={['50%']}
        headerComponent={
          <ModalHeader
            title={`${t('Notes pour')} ${reference}`}
            subTitle={t('Cliquez sur une note pour la modifier')}
          />
        }
      >
        <Box>
          {notes.length === 0 ? (
            <Box center py={40}>
              <Text color="grey">{t('Aucune note pour ce verset')}</Text>
            </Box>
          ) : (
            notes.map((item, index) => (
              <NoteItemRow
                key={`${item.id}-${index}`}
                item={item}
                onPress={() => handleOpenNote(item)}
              />
            ))
          )}
        </Box>
      </Modal.Body>
      <BibleNoteModal ref={noteModal.getRef()} noteVerses={noteVerses} />
      <AnnotationNoteModal
        ref={annotationNoteModal.getRef()}
        annotationId={selectedAnnotationNote?.annotationId ?? null}
        annotationText={selectedAnnotationNote?.text ?? ''}
        annotationVerseKey={selectedAnnotationNote?.verseKey ?? ''}
        existingNoteId={selectedAnnotationNote?.noteId}
        version={selectedAnnotationNote?.version as VersionCode}
      />
    </>
  )
})

VerseNotesModal.displayName = 'VerseNotesModal'

export default VerseNotesModal
