import * as Sentry from '@sentry/react-native'
import { useTheme } from '@emotion/react'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, ScrollView, Share } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
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
import { createNoteEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { getBibleViewParamsForVerseKeys } from '~features/studyRelations/openableStudyObjects'
import { toast } from '~helpers/toast'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import verseToReference from '~helpers/verseToReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
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
  initialVersion?: string
  onBackPress?: () => void
  isFormSheet?: boolean
}

const NoteDetailTabScreen = ({
  notesAtom,
  noteId,
  initialVerseKeys = [],
  initialVersion,
  onBackPress,
  isFormSheet = false,
}: NoteDetailTabScreenProps) => {
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const theme = useTheme()
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
  const scrollViewRef = useRef<ScrollView>(null)
  const scrollOffsetRef = useRef(0)
  const scrollViewportHeightRef = useRef(0)
  const editorLayoutYRef = useRef(0)
  const cursorBottomRef = useRef(0)
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const { colorScheme } = useCurrentThemeSelector()
  const fontSizeScale = useSelector((state: RootState) => state.user.bible.settings.fontSizeScale)
  const isCreating = !noteId

  const handleSizeChange = (_width: number, height: number) => {
    setWebViewHeight(Math.max(NOTE_EDITOR_MIN_HEIGHT, Math.ceil(height)))
  }

  const keepEditorCursorVisible = (viewportHeight = scrollViewportHeightRef.current) => {
    if (!isEditing || !viewportHeight || !cursorBottomRef.current) return

    const cursorY = editorLayoutYRef.current + cursorBottomRef.current
    const visibleTop = scrollOffsetRef.current
    const visibleBottom = visibleTop + viewportHeight
    const margin = 20

    if (cursorY > visibleBottom - margin) {
      const nextOffset = cursorY - viewportHeight + margin
      scrollViewRef.current?.scrollTo({ y: nextOffset, animated: true })
      return
    }

    if (cursorY < visibleTop + margin) {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, cursorY - margin), animated: true })
    }
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
    ? createNoteEndpoint(noteId, getNoteTitle(currentNote, reference))
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
    const currentTitle = getNoteTitle(currentNote, '')
    if (currentTitle) {
      setNotesTab(
        produce(draft => {
          draft.title = currentTitle
        })
      )
    }
  }, [currentNote, setNotesTab])

  const onSaveNote = () => {
    const noteKey = isAnnotationNote && noteId ? noteId : currentNote?.id
    const shouldAttachVerses = isCreating || isCreatingAnnotationNote || hasInitialVerseKeys
    const targetVerses =
      isAnnotationNote && noteKey
        ? ({ [noteKey]: true } as VerseIds)
        : shouldAttachVerses
          ? noteVerses
          : ({} as VerseIds)
    const action = addNote(
      {
        ...currentNote,
        ...(noteKey ? { id: noteKey } : {}),
        title,
        description,
        date: Date.now(),
        ...((currentNote?.version || initialVersion || annotation?.version) && {
          version: currentNote?.version || initialVersion || annotation?.version,
        }),
      },
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

${getNoteTitle(currentNote, '')}

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
    let verseKeys: string[]
    let version: string | undefined = currentNote?.version || initialVersion

    if (isMissingAnnotation) {
      toast.error(t('Annotation introuvable'))
      return
    }

    if (isAnnotationNote && annotation) {
      verseKeys = annotation.ranges.map(range => range.verseKey)
      version = annotation.version
    } else {
      verseKeys = initialVerseKeys.length ? initialVerseKeys : relatedVerseKeys
    }

    if (!verseKeys.length) {
      toast.error(t('Référence introuvable'))
      return
    }

    pushRouteOnce({
      pathname: '/bible-view',
      params: getBibleViewParamsForVerseKeys(verseKeys, version),
    })
  }

  const submitIsDisabled = !description

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
      <KeyboardAvoidingView automaticOffset behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onLayout={event => {
            const viewportHeight = event.nativeEvent.layout.height
            scrollViewportHeightRef.current = viewportHeight
            keepEditorCursorVisible(viewportHeight)
          }}
          onScroll={event => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y
          }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: isEditing ? 20 : insets.bottom + 100,
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
                    version={currentNote?.version || initialVersion}
                  />
                ))
              ) : (
                <VerseAccordion
                  noteVerses={noteVerses}
                  version={currentNote?.version || initialVersion}
                />
              )
            ) : null}
            <Box
              onLayout={event => {
                editorLayoutYRef.current = event.nativeEvent.layout.y
              }}
            >
              <NoteEditorDOMComponent
                key={`${noteId || 'new'}-${editorResetKey}`}
                encodedDefaultTitle={encodeURIComponent(currentNote?.title || '')}
                encodedDefaultDescription={encodeURIComponent(currentNote?.description || '')}
                resetKey={editorResetKey}
                isEditing={isEditing}
                fontSizeScale={fontSizeScale}
                colorScheme={colorScheme}
                textColor={theme.colors.default}
                editorBackgroundColor={theme.colors.opacity5}
                placeholderColor={theme.colors.grey}
                placeholderTitle={t('notes.titlePlaceholder')}
                placeholderDescription={t('Description')}
                onTitleChange={setTitle}
                onDescriptionChange={setDescription}
                onSizeChange={handleSizeChange}
                onCursorPositionChange={bottom => {
                  cursorBottomRef.current = bottom
                  keepEditorCursorVisible()
                }}
                dom={{
                  useExpoDOMWebView: false,
                  containerStyle: { height: webViewHeight, overflow: 'hidden' },
                  style: { overflow: 'hidden' },
                  scrollEnabled: false,
                  keyboardDisplayRequiresUserAction: false,
                  hideKeyboardAccessoryView: true,
                }}
              />
            </Box>
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
        <Box
          position="absolute"
          bottom={(isFormSheet ? insets.bottom : bottomBarHeight) + 20}
          right={20}
        >
          <Fab
            accessibilityLabel={t('accessibility.editNote')}
            icon="edit-2"
            onPress={onEditNote}
          />
        </Box>
      )}
    </Box>
  )

  return <FormSheetScreen isFormSheet={isFormSheet}>{content}</FormSheetScreen>
}

export default NoteDetailTabScreen
