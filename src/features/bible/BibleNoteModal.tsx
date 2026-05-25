import * as Sentry from '@sentry/react-native'
import { useEffect, useState } from 'react'

import { Alert, Share } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { BottomSheetFooter, BottomSheetModal } from '@gorhom/bottom-sheet/'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import EntityChipList from '~common/EntityChipList'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import { VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import VerseAccordion from '~common/VerseAccordion'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'
import generateUUID from '~helpers/generateUUID'
import { toast } from '~helpers/toast'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote } from '~redux/modules/user'
import { makeNoteByIdSelector, makeVerseGroupsForNoteSelector } from '~redux/selectors/bible'
import { unifiedTagsModalAtom } from '../../state/app'
import NoteEditorBottomSheet from './NoteEditorDOM/NoteEditorBottomSheet'

interface BibleNoteModalProps {
  noteVerses: VerseIds | undefined
  noteId?: string | null
  onNoteIdChange?: (noteId: string) => void
  ref?: React.RefObject<BottomSheetModal | null>
}

const useCurrentNote = ({ noteId }: { noteId?: string | null }) => {
  const selectNoteById = makeNoteByIdSelector()
  const note = useSelector((state: RootState) => selectNoteById(state, noteId || ''))

  return note
}

const verseKeysToVerseIds = (verseKeys: string[]): VerseIds =>
  verseKeys.reduce((acc, key) => {
    acc[key] = true
    return acc
  }, {} as VerseIds)

const hasVerses = (verses: VerseIds | undefined): verses is VerseIds =>
  Boolean(verses && Object.keys(verses).length)

const BibleNoteModal = ({ noteVerses, noteId, onNoteIdChange, ref }: BibleNoteModalProps) => {
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  const currentNote = useCurrentNote({ noteId })
  const selectVerseGroupsForNote = makeVerseGroupsForNoteSelector()
  const relatedVerseGroups = useSelector((state: RootState) =>
    selectVerseGroupsForNote(state, currentNote?.id || noteId || '')
  )
  const allRelatedNoteVerses = relatedVerseGroups.length
    ? verseKeysToVerseIds(relatedVerseGroups.flat())
    : undefined
  const displayedNoteVerses = noteVerses ?? allRelatedNoteVerses
  const displayedVerseGroups = hasVerses(noteVerses)
    ? [noteVerses]
    : relatedVerseGroups.map(verseKeysToVerseIds)
  const hasDisplayedNoteVerses = displayedVerseGroups.length > 0
  const reference = verseToReference(displayedNoteVerses)
  const noteEndpoint = currentNote?.id
    ? {
        type: 'note' as const,
        noteId: currentNote.id,
        label: currentNote.title || currentNote.description || reference,
      }
    : null
  const relationCount = useRelationCount(noteEndpoint)
  const openEntityRelations = useOpenEntityRelations()
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
    if (noteVerses || noteId) {
      if (currentNote) {
        setIsEditing(false)
      } else {
        setIsEditing(true)
      }
    } else {
      setTitle('')
      setDescription('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteVerses, noteId])

  const onSaveNoteFunc = () => {
    const targetVerses = noteVerses ?? displayedNoteVerses ?? {}
    const action = addNote({ ...currentNote, title, description, date: Date.now() }, targetVerses)
    if (action) {
      dispatch(action)
      const savedNoteId = Object.keys(action.payload)[0]
      if (savedNoteId) {
        onNoteIdChange?.(savedNoteId)
      }
    }
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
    <>
      <Modal.Body
        ref={ref}
        topInset={useSafeAreaInsets().top}
        enableDynamicSizing
        enableContentPanningGesture={false}
        headerComponent={
          <ModalHeader
            title={t('Note')}
            subTitle={reference}
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
                      <MenuOption
                        onSelect={() => noteEndpoint && openEntityRelations(noteEndpoint)}
                      >
                        <Box row alignItems="center">
                          <FeatherIcon name="git-merge" size={15} />
                          <Text marginLeft={10}>{t('Éditer les relations')}</Text>
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
          <>
            {hasDisplayedNoteVerses &&
              displayedVerseGroups.map((verseGroup, index) => (
                <VerseAccordion
                  key={`${Object.keys(verseGroup).join('/')}-${index}`}
                  noteVerses={verseGroup}
                />
              ))}
            <NoteEditorBottomSheet
              defaultTitle={currentNote?.title || ''}
              defaultDescription={currentNote?.description || ''}
              isEditing={isEditing}
              placeholderTitle={t('Titre')}
              placeholderDescription={t('Description')}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
            />
            <EntityChipList
              tags={currentNote?.tags}
              relationCount={relationCount}
              onRelationPress={() => noteEndpoint && openEntityRelations(noteEndpoint)}
            />
          </>
        </Box>
      </Modal.Body>
    </>
  )
}

export default BibleNoteModal
