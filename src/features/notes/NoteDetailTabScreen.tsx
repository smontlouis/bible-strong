import * as Sentry from '@sentry/react-native'
import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Share } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import books from '~assets/bible_versions/books-desc'
import EntityChipList from '~common/EntityChipList'
import Header from '~common/Header'
import { VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import VerseAccordion from '~common/VerseAccordion'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import NoteEditorDOMComponent from '~features/bible/NoteEditorDOM/NoteEditorDOMComponent'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { toast } from '~helpers/toast'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import verseToReference from '~helpers/verseToReference'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { RootState } from '~redux/modules/reducer'
import type { RelationEndpoint } from '~redux/modules/user'
import { addNote, deleteNote } from '~redux/modules/user'
import { updateWordAnnotation } from '~redux/modules/user/wordAnnotations'
import {
  makeNoteByKeySelector,
  makeVerseGroupsForNoteSelector,
  makeVerseKeysForNoteSelector,
  makeWordAnnotationByIdSelector,
} from '~redux/selectors/bible'
import { isFullScreenBibleAtom, unifiedTagsModalAtom } from '~state/app'
import { NotesTab, useIsCurrentTab } from '~state/tabs'

const FOOTER_HEIGHT = 54
const NOTE_EDITOR_MIN_HEIGHT = 240

const verseKeysToVerseIds = (verseKeys: string[]): VerseIds =>
  verseKeys.reduce((acc, key) => {
    acc[key] = true
    return acc
  }, {} as VerseIds)

interface NoteDetailTabScreenProps {
  notesAtom: PrimitiveAtom<NotesTab>
  noteId?: string
  initialVerseKeys?: string[]
  onBackPress?: () => void
  isFormSheet?: boolean
}

const NoteDetailTabScreen = ({
  notesAtom,
  noteId,
  initialVerseKeys = [],
  onBackPress,
  isFormSheet = false,
}: NoteDetailTabScreenProps) => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [, setNotesTab] = useAtom(notesAtom)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)
  const openEntityRelations = useOpenEntityRelations()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : Boolean(onBackPress)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editorResetKey, setEditorResetKey] = useState(0)
  const [webViewHeight, setWebViewHeight] = useState(NOTE_EDITOR_MIN_HEIGHT)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const { colorScheme } = useCurrentThemeSelector()
  const isCreating = !noteId

  const handleSizeChange = (_width: number, height: number) => {
    setWebViewHeight(Math.max(NOTE_EDITOR_MIN_HEIGHT, Math.ceil(height)))
  }

  // Force full screen bible mode off when this tab becomes active
  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = getIsCurrentTab(notesAtom)

  useEffect(() => {
    if (isCurrentTab) {
      setIsFullScreenBible(false)
    }
  }, [isCurrentTab, setIsFullScreenBible])

  useEffect(() => {
    if (!isFormSheet) return

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      event => setKeyboardHeight(event.endCoordinates.height)
    )
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    )

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [isFormSheet])

  const selectNoteByKey = makeNoteByKeySelector()
  const currentNote = useSelector((state: RootState) => selectNoteByKey(state, noteId || ''))

  // Get annotation data if this is an annotation note
  const isAnnotationNote = Boolean(noteId?.startsWith('annotation:'))
  const annotationId = isAnnotationNote && noteId ? noteId.replace('annotation:', '') : ''
  const selectAnnotationById = makeWordAnnotationByIdSelector()
  const annotation = useSelector((state: RootState) => selectAnnotationById(state, annotationId))
  const isMissingAnnotation = isAnnotationNote && !annotation
  const isCreatingAnnotationNote = Boolean(isAnnotationNote && annotation && !currentNote)
  const selectVerseKeysForNote = makeVerseKeysForNoteSelector()
  const relatedVerseKeys = useSelector((state: RootState) => selectVerseKeysForNote(state, noteId))
  const selectVerseGroupsForNote = makeVerseGroupsForNoteSelector()
  const relatedVerseGroups = useSelector((state: RootState) =>
    selectVerseGroupsForNote(state, noteId)
  )
  const hasInitialVerseKeys = initialVerseKeys.length > 0

  // Parse noteId to get verse references for display
  const noteVerses = useMemo(() => {
    // For annotation notes, use the annotation's first range verseKey
    if (isAnnotationNote && !annotation) {
      return {} as VerseIds
    }
    if (isAnnotationNote && annotation) {
      const verseKey = annotation.ranges[0]?.verseKey
      return verseKey ? { [verseKey]: true as const } : ({} as VerseIds)
    }
    const verseKeys = hasInitialVerseKeys ? initialVerseKeys : relatedVerseKeys
    return verseKeys.reduce((acc, key) => {
      acc[key] = true as const
      return acc
    }, {} as VerseIds)
  }, [isAnnotationNote, annotation, hasInitialVerseKeys, initialVerseKeys, relatedVerseKeys])
  const hasNoteVerses = Object.keys(noteVerses).length > 0

  const reference = useMemo(() => {
    if (isMissingAnnotation) {
      return t('Annotation introuvable')
    }

    const baseRef = verseToReference(noteVerses)
    if (isAnnotationNote && annotation) {
      return `${baseRef} (${t('annotation')} - ${annotation.version})`
    }
    return baseRef
  }, [noteVerses, isAnnotationNote, annotation, isMissingAnnotation, t])

  const noteEndpoint: Extract<RelationEndpoint, { type: 'note' }> | null = noteId
    ? {
        type: 'note',
        noteId,
        label: currentNote?.title || currentNote?.description || reference,
      }
    : null
  const relationCount = useRelationCount(noteEndpoint)

  // Go back to notes list
  const goBack = useCallback(() => {
    if (onBackPress) {
      onBackPress()
      return
    }

    setNotesTab(
      produce(draft => {
        draft.title = t('Notes')
        draft.data.noteId = undefined
      })
    )
  }, [onBackPress, setNotesTab, t])

  // Initialize form when note loads
  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title || '')
      setDescription(currentNote.description || '')
      setIsEditing(false)
      setEditorResetKey(key => key + 1)
    } else if (isCreating || isCreatingAnnotationNote) {
      setTitle('')
      setDescription('')
      setIsEditing(true)
      setEditorResetKey(key => key + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, isCreating, isCreatingAnnotationNote])

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
    const noteKey = isAnnotationNote && noteId ? noteId : currentNote?.id
    const targetVerses =
      isAnnotationNote && noteKey ? ({ [noteKey]: true } as VerseIds) : noteVerses
    const action = addNote(
      { ...currentNote, ...(noteKey ? { id: noteKey } : {}), title, description, date: Date.now() },
      targetVerses
    )
    if (action) {
      dispatch(action)
      const savedNoteId = Object.keys(action.payload)[0]
      if (savedNoteId) {
        if (isAnnotationNote && annotationId) {
          dispatch(updateWordAnnotation(annotationId, { noteId: savedNoteId }))
        }
        if (isCreating) {
          router.setParams({ noteId: savedNoteId })
        }
      }
    }
    setIsEditing(false)
  }

  const deleteNoteFunc = () => {
    if (!noteId) return

    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer cette note?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteNote(noteId))
          if (isAnnotationNote && annotationId) {
            dispatch(updateWordAnnotation(annotationId, { noteId: undefined }))
          }
          goBack()
        },
        style: 'destructive',
      },
    ])
  }

  const cancelEditing = () => {
    if (!currentNote) {
      goBack()
      return
    }

    setTitle(currentNote?.title || '')
    setDescription(currentNote?.description || '')
    setIsEditing(false)
    setEditorResetKey(key => key + 1)
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
      console.log('[Notes] Error sharing note:', e)
      Sentry.captureException(e)
    }
  }

  const onEditNote = () => {
    setTitle(currentNote?.title || '')
    setDescription(currentNote?.description || '')
    setEditorResetKey(key => key + 1)
    setIsEditing(true)
  }

  const navigateToBible = () => {
    let verseKey: string
    let version: string | undefined

    if (isMissingAnnotation) {
      toast.error(t('Annotation introuvable'))
      return
    }

    if (isAnnotationNote && annotation) {
      // For annotation notes, use the annotation's verseKey and version
      verseKey = annotation.ranges[0]?.verseKey
      version = annotation.version
    } else {
      verseKey = initialVerseKeys[0] || relatedVerseKeys[0]
    }

    if (!verseKey) {
      toast.error(t('Référence introuvable'))
      return
    }

    const [Livre, Chapitre, Verset] = verseKey.split('-')
    if (!Livre || !Chapitre || !Verset) {
      toast.error(t('Référence introuvable'))
      return
    }

    router.push({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
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
  if (noteId && !currentNote && !isCreatingAnnotationNote) {
    const content = (
      <>
        <Box flex center px={20}>
          <Text fontSize={18} color="grey" textAlign="center" mb={20}>
            {t("Cette note n'existe plus")}
          </Text>
          <Button onPress={goBack}>{t('Retour aux notes')}</Button>
        </Box>
      </>
    )

    return <FormSheetScreen isFormSheet={isFormSheet}>{content}</FormSheetScreen>
  }

  if (isMissingAnnotation) {
    const content = (
      <>
        <Header
          title={t('Annotation introuvable')}
          hasBackButton={hasBackButton}
          onCustomBackPress={goBack}
        />
        <Box flex center px={20}>
          <Text fontSize={18} color="grey" textAlign="center" mb={20}>
            {t("Cette annotation n'existe plus")}
          </Text>
          <Button onPress={goBack}>{t('Retour aux notes')}</Button>
        </Box>
      </>
    )

    return <FormSheetScreen isFormSheet={isFormSheet}>{content}</FormSheetScreen>
  }

  const content = (
    <Box flex>
      <Header
        title={isAnnotationNote ? t("Note d'annotation") : t('Note')}
        subTitle={reference}
        hasBackButton={hasBackButton}
        onCustomBackPress={goBack}
        rightComponent={
          currentNote ? (
            <MenuView
              actions={
                [
                  { id: 'share', title: t('Partager'), image: 'square.and.arrow.up' },
                  { id: 'edit', title: t('Éditer'), image: 'pencil' },
                  { id: 'tags', title: t('Éditer les tags'), image: 'tag' },
                  noteEndpoint
                    ? {
                        id: 'relations',
                        title: t('Éditer les relations'),
                        image: 'arrow.triangle.merge',
                      }
                    : null,
                  { id: 'bible', title: t('Voir dans la Bible'), image: 'book' },
                  {
                    id: 'delete',
                    title: t('Supprimer'),
                    image: 'trash',
                    attributes: { destructive: true },
                  },
                ].filter(Boolean) as MenuAction[]
              }
              onPressAction={({ nativeEvent }) => {
                switch (nativeEvent.event) {
                  case 'share':
                    shareNote()
                    break
                  case 'edit':
                    onEditNote()
                    break
                  case 'tags':
                    setUnifiedTagsModal({
                      mode: 'select',
                      id: currentNote.id!,
                      entity: 'notes',
                    })
                    break
                  case 'relations':
                    if (noteEndpoint) openEntityRelations(noteEndpoint)
                    break
                  case 'bible':
                    navigateToBible()
                    break
                  case 'delete':
                    deleteNoteFunc()
                    break
                }
              }}
            >
              <Box row center height={54} width={54}>
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            </MenuView>
          ) : undefined
        }
      />
      <KeyboardAvoidingView
        behavior={!isFormSheet && Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: isEditing
              ? FOOTER_HEIGHT + (isFormSheet ? keyboardHeight : bottomBarHeight) + 20
              : insets.bottom + 100,
          }}
        >
          <Box gap={20}>
            <EntityChipList
              tags={currentNote?.tags}
              relationCount={relationCount}
              onRelationPress={() => noteEndpoint && openEntityRelations(noteEndpoint)}
            />
            {isAnnotationNote && annotation ? (
              <Box bg="opacity5" borderRadius={8} py={12} px={16}>
                <Text fontSize={14} color="grey" mb={4}>
                  {t('Texte annoté')}
                </Text>
                <Text fontSize={16} fontWeight="600">
                  {annotation.ranges.map(r => r.text).join(' ')}
                </Text>
              </Box>
            ) : hasNoteVerses ? (
              !hasInitialVerseKeys && relatedVerseGroups.length ? (
                relatedVerseGroups.map((verseKeys, index) => (
                  <VerseAccordion
                    key={`${verseKeys.join('/')}-${index}`}
                    noteVerses={verseKeysToVerseIds(verseKeys)}
                  />
                ))
              ) : (
                <VerseAccordion noteVerses={noteVerses} />
              )
            ) : null}
            <NoteEditorDOMComponent
              defaultTitle={currentNote?.title || ''}
              defaultDescription={currentNote?.description || ''}
              resetKey={editorResetKey}
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
          </Box>
        </ScrollView>
        {isEditing && (
          <HStack
            position={isFormSheet ? 'absolute' : undefined}
            left={isFormSheet ? 0 : undefined}
            right={isFormSheet ? 0 : undefined}
            bottom={isFormSheet ? keyboardHeight : undefined}
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
        <Box
          position="absolute"
          bottom={(isFormSheet ? insets.bottom : bottomBarHeight) + 20}
          right={20}
        >
          <Fab icon="edit-2" onPress={onEditNote} />
        </Box>
      )}
    </Box>
  )

  return <FormSheetScreen isFormSheet={isFormSheet}>{content}</FormSheetScreen>
}

export default NoteDetailTabScreen
