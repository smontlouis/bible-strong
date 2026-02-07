import * as Sentry from '@sentry/react-native'
import { useEffect, useState } from 'react'

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
import { VerseIds } from '~common/types'
import VerseAccordion from '~common/VerseAccordion'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'
import orderVerses from '~helpers/orderVerses'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote } from '~redux/modules/user'
import { makeNoteByKeySelector } from '~redux/selectors/bible'
import { unifiedTagsModalAtom } from '../../state/app'
import NoteEditorBottomSheet from './NoteEditorDOM/NoteEditorBottomSheet'

interface BibleNoteModalProps {
  noteVerses: VerseIds | undefined
  ref?: React.RefObject<BottomSheetModal | null>
}

const useCurrentNote = ({ noteVerses }: { noteVerses: VerseIds | undefined }) => {
  const selectNoteByKey = makeNoteByKeySelector()
  const orderedVerses = orderVerses(noteVerses || {})
  const noteKey = Object.keys(orderedVerses).join('/')

  const note = useSelector((state: RootState) => selectNoteByKey(state, noteKey))

  return note
}

const BibleNoteModal = ({ noteVerses, ref }: BibleNoteModalProps) => {
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  const currentNote = useCurrentNote({ noteVerses })
  const reference = verseToReference(noteVerses)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const openInNewTab = useOpenInNewTab()

  const close = () => {
    ref?.current?.dismiss()
  }

  const openNoteInNewTab = () => {
    if (!currentNote?.id) return
    close()
    setTimeout(() => {
      openInNewTab({
        id: `notes-${generateUUID()}`,
        title: t('Notes'),
        isRemovable: true,
        type: 'notes',
        data: { noteId: currentNote.id },
      })
    }, 300)
  }

  useEffect(() => {
    if (noteVerses) {
      if (currentNote) {
        setIsEditing(false)
      } else {
        setIsEditing(true)
      }
    } else {
      setTitle('')
      setDescription('')
    }
  }, [noteVerses])

  const onSaveNoteFunc = () => {
    dispatch(
      // @ts-ignore
      addNote({ ...currentNote, title, description, date: Date.now() }, noteVerses!)
    )
    setIsEditing(false)
  }

  const deleteNoteFunc = (noteId: string) => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette note?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteNote(noteId))
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
Note pour ${reference}

${currentNote.title}

${currentNote.description}
      `
      Share.share({ message })
    } catch (e) {
      toast.error(t('Erreur lors du partage.'))
      console.log('[Bible] Error sharing note:', e)
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
          subTitle={t('Note')}
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
                        <Text marginLeft={10}>{t('Éditer')}</Text>
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
                        <Text marginLeft={10}>{t('Éditer les tags')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={openNoteInNewTab}>
                      <Box row alignItems="center">
                        <FeatherIcon name="external-link" size={15} />
                        <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={() => deleteNoteFunc(currentNote?.id!)}>
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
                <Button disabled={submitIsDisabled} onPress={onSaveNoteFunc}>
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
        {noteVerses && (
          <>
            <VerseAccordion noteVerses={noteVerses} />
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

export default BibleNoteModal
