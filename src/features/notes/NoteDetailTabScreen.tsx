import * as Sentry from '@sentry/react-native'
import produce from 'immer'
import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from '~helpers/toast'
import { useRouter } from 'expo-router'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import TagList from '~common/TagList'
import { VerseIds } from '~common/types'
import VerseAccordion from '~common/VerseAccordion'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import books from '~assets/bible_versions/books-desc'
import { timeout } from '~helpers/timeout'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addNote, deleteNote } from '~redux/modules/user'
import { makeNoteByKeySelector, makeWordAnnotationByIdSelector } from '~redux/selectors/bible'
import { isFullScreenBibleAtom, unifiedTagsModalAtom } from '~state/app'
import { NotesTab, useIsCurrentTab } from '~state/tabs'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import NoteEditorDOMComponent from '~features/bible/NoteEditorDOM/NoteEditorDOMComponent'

const FOOTER_HEIGHT = 54

interface NoteDetailTabScreenProps {
  notesAtom: PrimitiveAtom<NotesTab>
  noteId: string
}

const NoteDetailTabScreen = ({ notesAtom, noteId }: NoteDetailTabScreenProps) => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [, setNotesTab] = useAtom(notesAtom)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [webViewHeight, setWebViewHeight] = useState(100)
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const { colorScheme } = useCurrentThemeSelector()

  const handleSizeChange = (_width: number, height: number) => {
    setWebViewHeight(height)
  }

  // Force full screen bible mode off when this tab becomes active
  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = getIsCurrentTab(notesAtom)

  useEffect(() => {
    if (isCurrentTab) {
      setIsFullScreenBible(false)
    }
  }, [isCurrentTab, setIsFullScreenBible])

  const selectNoteByKey = makeNoteByKeySelector()
  const currentNote = useSelector((state: RootState) => selectNoteByKey(state, noteId))

  // Get annotation data if this is an annotation note
  const isAnnotationNote = noteId.startsWith('annotation:')
  const annotationId = isAnnotationNote ? noteId.replace('annotation:', '') : ''
  const selectAnnotationById = makeWordAnnotationByIdSelector()
  const annotation = useSelector((state: RootState) => selectAnnotationById(state, annotationId))

  // Parse noteId to get verse references for display
  const noteVerses = useMemo(() => {
    // For annotation notes, use the annotation's first range verseKey
    if (isAnnotationNote && annotation) {
      const verseKey = annotation.ranges[0]?.verseKey
      return verseKey ? { [verseKey]: true as const } : ({} as VerseIds)
    }
    // For regular notes, parse the noteId
    return noteId.split('/').reduce((acc, key) => {
      acc[key] = true as const
      return acc
    }, {} as VerseIds)
  }, [noteId, isAnnotationNote, annotation])

  const reference = useMemo(() => {
    const baseRef = verseToReference(noteVerses)
    if (isAnnotationNote && annotation) {
      return `${baseRef} (${t('annotation')} - ${annotation.version})`
    }
    return baseRef
  }, [noteVerses, isAnnotationNote, annotation, t])

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
    if (!currentNote) return
    try {
      const message = `
Note pour ${reference}

${currentNote.title}

${currentNote.description}
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
    let verseKey: string
    let version: string | undefined

    if (isAnnotationNote && annotation) {
      // For annotation notes, use the annotation's verseKey and version
      verseKey = annotation.ranges[0]?.verseKey
      version = annotation.version
    } else {
      // For regular notes, use the first verse from noteId
      verseKey = noteId.split('/')[0]
    }

    const [Livre, Chapitre, Verset] = verseKey.split('-')
    router.push({
      pathname: '/bible-view',
      params: {
        isReadOnly: 'true',
        book: JSON.stringify(books[Number(Livre) - 1]),
        chapter: String(Number(Chapitre)),
        verse: String(Number(Verset)),
        focusVerses: JSON.stringify([Number(Verset)]),
        ...(version && { version }),
      },
    })
  }

  const submitIsDisabled = !title || !description

  // Show message if note doesn't exist
  if (!currentNote) {
    return (
      <Container>
        <Box flex center px={20}>
          <Text fontSize={18} color="grey" textAlign="center" mb={20}>
            {t("Cette note n'existe plus")}
          </Text>
          <Button onPress={goBack}>{t('Retour aux notes')}</Button>
        </Box>
      </Container>
    )
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: isEditing ? FOOTER_HEIGHT + bottomBarHeight + 20 : insets.bottom + 100,
          }}
        >
          <Box gap={20}>
            {isAnnotationNote && annotation ? (
              <Box bg="opacity5" borderRadius={8} py={12} px={16}>
                <Text fontSize={14} color="grey" mb={4}>
                  {t('Texte annoté')}
                </Text>
                <Text fontSize={16} fontWeight="600">
                  {annotation.ranges.map(r => r.text).join(' ')}
                </Text>
              </Box>
            ) : (
              <VerseAccordion noteVerses={noteVerses} />
            )}
            <NoteEditorDOMComponent
              defaultTitle={currentNote?.title || ''}
              defaultDescription={currentNote?.description || ''}
              isEditing={isEditing}
              colorScheme={colorScheme}
              placeholderTitle={t('Titre')}
              placeholderDescription={t('Description')}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onSizeChange={handleSizeChange}
              dom={{
                containerStyle: { height: webViewHeight, overflow: 'hidden' },
                style: { overflow: 'hidden' },
                scrollEnabled: false,
                hideKeyboardAccessoryView: true,
              }}
            />
            <TagList tags={currentNote?.tags} />
          </Box>
        </ScrollView>
        {isEditing && (
          <HStack
            py={10}
            px={20}
            justifyContent="flex-end"
            bg="reverse"
            borderTopWidth={1}
            borderColor="border"
            gap={10}
          >
            <Button reverse onPress={cancelEditing}>
              {t('Annuler')}
            </Button>
            <Button disabled={submitIsDisabled} onPress={onSaveNote}>
              {t('Sauvegarder')}
            </Button>
          </HStack>
        )}
      </KeyboardAvoidingView>
      {!isEditing && (
        <Box position="absolute" bottom={bottomBarHeight + 20} right={20}>
          <Fab icon="edit-2" onPress={onEditNote} />
        </Box>
      )}
    </Container>
  )
}

export default NoteDetailTabScreen
