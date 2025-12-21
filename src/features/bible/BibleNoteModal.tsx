import * as Sentry from '@sentry/react-native'
import React, { useEffect, useMemo, useState } from 'react'

import { createSelector } from '@reduxjs/toolkit'
import { Alert, ScrollView, Share } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { BottomSheetFooter } from '@gorhom/bottom-sheet/'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import Snackbar from '~common/SnackBar'
import TagList from '~common/TagList'
import { VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Paragraph from '~common/ui/Paragraph'
import Spacer from '~common/ui/Spacer'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import TextArea from '~common/ui/TextArea'
import TextInput from '~common/ui/TextInput'
import orderVerses from '~helpers/orderVerses'
import { timeout } from '~helpers/timeout'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote, Note } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'

interface BibleNoteModalProps {
  noteVerses: VerseIds | undefined
  onClosed: () => void
}

// Create a memoized selector factory for current note
const makeCurrentNoteSelector = () =>
  createSelector(
    [(state: RootState) => state.user.bible.notes, (_: RootState, noteKey: string) => noteKey],
    (notes, noteKey): (Note & { id: string }) | null => {
      if (noteKey && notes[noteKey]) {
        return {
          id: noteKey,
          ...notes[noteKey],
        }
      }
      return null
    }
  )

const useCurrentNote = ({ noteVerses }: { noteVerses: VerseIds | undefined }) => {
  const selectCurrentNote = useMemo(() => makeCurrentNoteSelector(), [])
  const noteKey = useMemo(() => {
    const orderedVerses = orderVerses(noteVerses || {})
    return Object.keys(orderedVerses).join('/')
  }, [noteVerses])

  const note = useSelector((state: RootState) => selectCurrentNote(state, noteKey))

  return note
}

const BibleNoteModal = ({ noteVerses }: BibleNoteModalProps) => {
  const { ref, open, close } = useBottomSheetModal()
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  const currentNote = useCurrentNote({ noteVerses })
  const reference = verseToReference(noteVerses)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  useEffect(() => {
    if (noteVerses) {
      open()
    }
  }, [noteVerses, open])

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
    try {
      const message = `
Note pour ${reference}

${currentNote?.title}

${currentNote?.description}
      `
      await timeout(400)
      Share.share({ message })
    } catch (e) {
      Snackbar.show(t('Erreur lors du partage.'))
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
      snapPoints={['100%']}
      headerComponent={
        <ModalHeader
          onClose={close}
          title={reference}
          subTitle={t('Note')}
          rightComponent={
            currentNote ? (
              <PopOverMenu
                width={24}
                height={54}
                popover={
                  <>
                    <MenuOption onSelect={shareNote}>
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
                        setMultipleTagsItem({
                          ...currentNote,
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
          <BottomSheetFooter {...props}>
            <HStack py={10} px={20} justifyContent="flex-end" paddingBottom={insets.bottom}>
              {currentNote && (
                <Box>
                  <Button reverse onPress={cancelEditing}>
                    {t('Annuler')}
                  </Button>
                </Box>
              )}
              <Box>
                <Button disabled={submitIsDisabled} onPress={onSaveNoteFunc}>
                  {t('Sauvegarder')}
                </Button>
              </Box>
            </HStack>
          </BottomSheetFooter>
        ) : (
          <BottomSheetFooter {...props}>
            <HStack py={10} px={20} justifyContent="flex-end" paddingBottom={insets.bottom}>
              <Box>
                <Fab icon="edit-2" onPress={onEditNote} />
              </Box>
            </HStack>
          </BottomSheetFooter>
        )
      }
    >
      <Box paddingHorizontal={20}>
        {isEditing && (
          <>
            <TextInput
              placeholder={t('Titre')}
              onChangeText={setTitle}
              value={title}
              style={{ marginTop: 20 }}
            />
            <Spacer />
            <TextArea
              placeholder={t('Description')}
              onChangeText={setDescription}
              value={description}
            />
          </>
        )}
        {!isEditing && (
          <>
            <Box py={20}>
              <Text title fontSize={20} marginBottom={10}>
                {currentNote?.title}
              </Text>
              <ScrollView style={{ flex: 1 }}>
                <Paragraph small>{currentNote?.description}</Paragraph>
                {/* @ts-ignore */}
                <TagList tags={currentNote?.tags} />
              </ScrollView>
            </Box>
          </>
        )}
      </Box>
    </Modal.Body>
  )
}

export default BibleNoteModal
