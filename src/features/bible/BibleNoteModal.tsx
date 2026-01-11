import styled from '@emotion/native'
import * as Sentry from '@sentry/react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { createSelector } from '@reduxjs/toolkit'
import { Alert, ScrollView, Share } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { useTheme } from '@emotion/react'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet/'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import TagList from '~common/TagList'
import { VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Paragraph from '~common/ui/Paragraph'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'
import orderVerses from '~helpers/orderVerses'
import { timeout } from '~helpers/timeout'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote, Note } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'

const StyledTextInput = styled(BottomSheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

const StyledTextArea = styled(BottomSheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  maxHeight: 300,
  minHeight: 150,
  paddingHorizontal: 15,
  paddingVertical: 15,
  fontSize: 16,
  textAlignVertical: 'top',
}))

interface BibleNoteModalProps {
  noteVerses: VerseIds | undefined
  ref?: React.RefObject<BottomSheetModal | null>
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

const BibleNoteModal = ({ noteVerses, ref }: BibleNoteModalProps) => {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  const currentNote = useCurrentNote({ noteVerses })
  const reference = verseToReference(noteVerses)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const openInNewTab = useOpenInNewTab()

  const close = useCallback(() => {
    ref?.current?.dismiss()
  }, [ref])

  const openNoteInNewTab = useCallback(() => {
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
  }, [currentNote?.id, close, openInNewTab, t])

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
          <BottomSheetFooter {...props}>
            <HStack py={5} px={20} justifyContent="flex-end" paddingBottom={insets.bottom}>
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
          <BottomSheetFooter {...props}>
            <HStack
              py={10}
              px={20}
              justifyContent="flex-end"
              paddingBottom={insets.bottom + 5}
              bg="reverse"
            >
              <Box>
                <Fab icon="edit-2" onPress={onEditNote} />
              </Box>
            </HStack>
          </BottomSheetFooter>
        )
      }
    >
      <Box paddingHorizontal={20} gap={10} pb={20}>
        {isEditing && (
          <>
            <StyledTextInput
              placeholder={t('Titre')}
              placeholderTextColor={theme.colors.grey}
              onChangeText={setTitle}
              value={title}
              style={{ marginTop: 20 }}
            />
            <StyledTextArea
              placeholder={t('Description')}
              placeholderTextColor={theme.colors.grey}
              onChangeText={setDescription}
              value={description}
              multiline
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
