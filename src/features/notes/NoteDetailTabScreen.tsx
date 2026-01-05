import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Sentry from '@sentry/react-native'
import produce from 'immer'
import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, Share, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner-native'

import { createSelector } from '@reduxjs/toolkit'
import * as Icon from '@expo/vector-icons'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Paragraph from '~common/ui/Paragraph'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import books from '~assets/bible_versions/books-desc'
import { timeout } from '~helpers/timeout'
import verseToReference from '~helpers/verseToReference'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote, Note } from '~redux/modules/user'
import { isFullScreenBibleValue, multipleTagsModalAtom } from '~state/app'
import { NotesTab, useIsCurrentTab } from '~state/tabs'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'

const StyledTextInput = styled(TextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

const StyledTextArea = styled(TextInput)(({ theme }) => ({
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

interface NoteDetailTabScreenProps {
  navigation: StackNavigationProp<MainStackProps>
  notesAtom: PrimitiveAtom<NotesTab>
  noteId: string
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

const NoteDetailTabScreen = ({ navigation, notesAtom, noteId }: NoteDetailTabScreenProps) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [, setNotesTab] = useAtom(notesAtom)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const { bottomBarHeight } = useBottomBarHeightInTab()

  // Force full screen bible mode off when this tab becomes active
  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = getIsCurrentTab(notesAtom)

  useEffect(() => {
    if (isCurrentTab) {
      isFullScreenBibleValue.set(false)
    }
  }, [isCurrentTab])

  const selectCurrentNote = useMemo(() => makeCurrentNoteSelector(), [])
  const currentNote = useSelector((state: RootState) => selectCurrentNote(state, noteId))

  // Parse noteId to get verse references for display
  const noteVerses = useMemo(() => {
    return noteId.split('/').reduce(
      (acc, key) => {
        acc[key] = true
        return acc
      },
      {} as Record<string, boolean>
    )
  }, [noteId])

  const reference = verseToReference(noteVerses)

  // Go back to notes list
  const goBack = useCallback(() => {
    setNotesTab(
      produce(draft => {
        draft.title = t('Notes')
        draft.data.noteId = undefined
      })
    )
  }, [setNotesTab, t])

  // Initialize form when note loads
  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title || '')
      setDescription(currentNote.description || '')
      setIsEditing(false)
    } else {
      // Note doesn't exist anymore, go back to list
      goBack()
    }
  }, [noteId])

  // Update tab title when note title changes
  useEffect(() => {
    if (currentNote?.title) {
      setNotesTab(
        produce(draft => {
          draft.title = currentNote.title
        })
      )
    }
  }, [currentNote?.title, setNotesTab])

  const onSaveNote = () => {
    dispatch(
      // @ts-ignore
      addNote({ ...currentNote, title, description, date: Date.now() }, noteVerses)
    )
    setIsEditing(false)
  }

  const deleteNoteFunc = () => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette note?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteNote(noteId))
          goBack()
        },
        style: 'destructive',
      },
    ])
  }

  const cancelEditing = () => {
    setTitle(currentNote?.title || '')
    setDescription(currentNote?.description || '')
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
      console.log('[Notes] Error sharing note:', e)
      Sentry.captureException(e)
    }
  }

  const onEditNote = () => {
    setTitle(currentNote?.title || '')
    setDescription(currentNote?.description || '')
    setIsEditing(true)
  }

  const navigateToBible = () => {
    const [Livre, Chapitre, Verset] = noteId.split('/')[0].split('-')
    // @ts-ignore
    navigation.navigate('BibleView', {
      isReadOnly: true,
      book: books[Number(Livre) - 1],
      chapter: Number(Chapitre),
      verse: Number(Verset),
      focusVerses: [Number(Verset)],
    })
  }

  const submitIsDisabled = !title || !description

  if (!currentNote) {
    return null
  }

  return (
    <Container>
      <Header
        title={reference}
        rightComponent={
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
                <MenuOption onSelect={navigateToBible}>
                  <Box row alignItems="center">
                    <FeatherIcon name="book-open" size={15} />
                    <Text marginLeft={10}>{t('Voir dans la Bible')}</Text>
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
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
      >
        {isEditing ? (
          <Box gap={10}>
            <StyledTextInput
              placeholder={t('Titre')}
              placeholderTextColor={theme.colors.grey}
              onChangeText={setTitle}
              value={title}
            />
            <StyledTextArea
              placeholder={t('Description')}
              placeholderTextColor={theme.colors.grey}
              onChangeText={setDescription}
              value={description}
              multiline
            />
            <HStack justifyContent="flex-end" gap={10} marginTop={20}>
              <Button reverse onPress={cancelEditing}>
                {t('Annuler')}
              </Button>
              <Button disabled={submitIsDisabled} onPress={onSaveNote}>
                {t('Sauvegarder')}
              </Button>
            </HStack>
          </Box>
        ) : (
          <Box>
            <Text title fontSize={20} marginBottom={10}>
              {currentNote?.title}
            </Text>
            <Paragraph>{currentNote?.description}</Paragraph>
            {/* @ts-ignore */}
            <TagList tags={currentNote?.tags} />
          </Box>
        )}
      </ScrollView>
      {!isEditing && (
        <Box position="absolute" bottom={bottomBarHeight + 20} right={20}>
          <Fab icon="edit-2" onPress={onEditNote} />
        </Box>
      )}
    </Container>
  )
}

export default NoteDetailTabScreen
