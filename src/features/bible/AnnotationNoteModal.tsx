import * as Sentry from '@sentry/react-native'
import React, { useEffect, useState } from 'react'

import { Alert, Share } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { BottomSheetFooter, BottomSheetModal } from '@gorhom/bottom-sheet/'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from '~helpers/toast'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote } from '~redux/modules/user'
import { makeNoteByKeySelector } from '~redux/selectors/bible'
import { updateWordAnnotation } from '~redux/modules/user/wordAnnotations'
import { unifiedTagsModalAtom } from '../../state/app'
import { VersionCode } from '../../state/tabs'
import NoteEditorBottomSheet from './NoteEditorDOM/NoteEditorBottomSheet'

interface AnnotationNoteModalProps {
  ref?: React.RefObject<BottomSheetModal | null>
  annotationId: string | null
  annotationText: string
  annotationVerseKey: string
  existingNoteId?: string
  version: VersionCode
  onNoteIdUpdate?: (noteId: string | undefined) => void
}

const AnnotationNoteModal = ({
  ref,
  annotationId,
  annotationText,
  annotationVerseKey,
  existingNoteId,
  version,
  onNoteIdUpdate,
}: AnnotationNoteModalProps) => {
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  // Note key for annotation notes: annotation:{annotationId}
  const noteKey = annotationId ? `annotation:${annotationId}` : ''

  const selectNoteByKey = makeNoteByKeySelector()
  const currentNote = useSelector((state: RootState) => selectNoteByKey(state, noteKey))

  // Get verse reference for display
  const reference = annotationVerseKey
    ? `${verseToReference({ [annotationVerseKey]: true })} (${version})`
    : ''

  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)

  const close = () => {
    ref?.current?.dismiss()
  }

  useEffect(() => {
    if (annotationId) {
      if (currentNote) {
        setIsEditing(false)
      } else {
        setIsEditing(true)
      }
    } else {
      setTitle('')
      setDescription('')
    }
  }, [annotationId, currentNote])

  const onSaveNote = () => {
    if (!annotationId) return

    // Dispatch addNote with the annotation note key
    dispatch(
      // @ts-ignore - addNote accepts noteVerses as second arg but we're using a custom key format
      addNote(
        { ...currentNote, title, description, date: Date.now() },
        { [noteKey]: true } // Use noteKey as the verse identifier
      )
    )

    // If this is a new note, update the annotation with the noteId
    if (!existingNoteId) {
      dispatch(updateWordAnnotation(annotationId, { noteId: noteKey }))
      onNoteIdUpdate?.(noteKey)
    }

    setIsEditing(false)
  }

  const deleteNoteFunc = () => {
    if (!annotationId) return

    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette note?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteNote(noteKey))
          // Remove noteId from annotation
          dispatch(updateWordAnnotation(annotationId, { noteId: undefined }))
          onNoteIdUpdate?.(undefined)
          close()
        },
        style: 'destructive',
      },
    ])
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const shareNote = async () => {
    if (!currentNote) return
    try {
      const message = `
Note pour ${annotationText}
${reference}

${currentNote.title}

${currentNote.description}
      `
      Share.share({ message })
    } catch (e) {
      toast.error(t('Erreur lors du partage.'))
      console.log('[AnnotationNote] Error sharing note:', e)
      Sentry.captureException(e)
    }
  }

  const onEditNote = () => {
    setTitle(currentNote?.title || '')
    setDescription(currentNote?.description || '')
    setIsEditing(true)
  }

  const submitIsDisabled = !title || !description

  return (
    <Modal.Body
      ref={ref}
      topInset={useSafeAreaInsets().top}
      enableDynamicSizing
      enableContentPanningGesture={false}
      headerComponent={
        <ModalHeader
          title={reference}
          subTitle={t("Note d'annotation")}
          rightComponent={
            currentNote ? (
              <PopOverMenu
                width={54}
                height={54}
                popover={
                  <>
                    <MenuOption onSelect={shareNote} closeBeforeSelect>
                      <Box row alignItems="center">
                        <FeatherIcon name="share" size={15} />
                        <Text marginLeft={10}>{t('Partager')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={onEditNote}>
                      <Box row alignItems="center">
                        <FeatherIcon name="edit-2" size={15} />
                        <Text marginLeft={10}>{t('Editer')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption
                      onSelect={() =>
                        setUnifiedTagsModal({
                          mode: 'select',
                          id: currentNote.id!,
                          entity: 'notes',
                        })
                      }
                    >
                      <Box row alignItems="center">
                        <FeatherIcon name="tag" size={15} />
                        <Text marginLeft={10}>{t('Editer les tags')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={deleteNoteFunc}>
                      <Box row alignItems="center">
                        <FeatherIcon name="trash-2" size={15} />
                        <Text marginLeft={10}>{t('Supprimer')}</Text>
                      </Box>
                    </MenuOption>
                  </>
                }
              />
            ) : undefined
          }
        />
      }
      footerComponent={props =>
        isEditing ? (
          <BottomSheetFooter bottomInset={insets.bottom} {...props}>
            <HStack
              py={5}
              px={20}
              justifyContent="flex-end"
              bg="reverse"
              borderTopWidth={1}
              borderColor="border"
            >
              {currentNote && (
                <Box h={MODAL_FOOTER_HEIGHT}>
                  <Button reverse onPress={cancelEditing}>
                    {t('Annuler')}
                  </Button>
                </Box>
              )}
              <Box h={MODAL_FOOTER_HEIGHT}>
                <Button disabled={submitIsDisabled} onPress={onSaveNote}>
                  {t('Sauvegarder')}
                </Button>
              </Box>
            </HStack>
          </BottomSheetFooter>
        ) : (
          <BottomSheetFooter bottomInset={insets.bottom} {...props}>
            <HStack py={10} px={20} justifyContent="flex-end">
              <Box>
                <Fab icon="edit-2" onPress={onEditNote} />
              </Box>
            </HStack>
          </BottomSheetFooter>
        )
      }
    >
      <Box paddingHorizontal={20} gap={20} py={20}>
        {annotationId && (
          <>
            <Box bg="opacity5" borderRadius={8} py={12} px={16}>
              <Text fontSize={14} color="grey" mb={4}>
                {t('Texte annoté')}
              </Text>
              <Text fontSize={16} fontWeight="600">
                {`...${annotationText}...`}
              </Text>
            </Box>
            <NoteEditorBottomSheet
              defaultTitle={currentNote?.title || ''}
              defaultDescription={currentNote?.description || ''}
              isEditing={isEditing}
              placeholderTitle={t('Titre')}
              placeholderDescription={t('Description')}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
            />
            <TagList tags={currentNote?.tags} />
          </>
        )}
      </Box>
    </Modal.Body>
  )
}

export default AnnotationNoteModal
