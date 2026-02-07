import * as Sentry from '@sentry/react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'expo-router'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { resetBiblesDb } from '~helpers/biblesDb'
import { toast } from '~helpers/toast'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { BibleError } from '~helpers/bibleErrors'
import getBiblePericope from '~helpers/getBiblePericope'
import loadBibleChapter from '~helpers/loadBibleChapter'
import { loadRedWords } from '~helpers/loadRedWords'
import loadMhyComments from '~helpers/loadMhyComments'
import { usePrevious } from '~helpers/usePrevious'
import BibleHeader from './BibleHeader'

import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import type { Bookmark } from '~common/types'
import { BibleResource, Pericope, SelectedCode, Verse, VerseIds } from '~common/types'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import BookmarkModal from '~features/bookmarks/BookmarkModal'
import AddToStudyModal from '~features/studies/AddToStudyModal'
import { useAddVerseToStudy } from '~features/studies/hooks/useAddVerseToStudy'
import VerseFormatBottomSheet from '~features/studies/VerseFormatBottomSheet'
import generateUUID from '~helpers/generateUUID'
import getVersesContent from '~helpers/getVersesContent'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { useBottomSheet, useBottomSheetModal } from '~helpers/useBottomSheet'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'
import { addHighlight, removeHighlight } from '~redux/modules/user'
import {
  CrossVersionAnnotation,
  makeHighlightsByChapterSelector,
  makeLinksByChapterSelector,
  makeNotesByChapterSelector,
  makeSelectedVerseHighlightColorSelector,
  makeTaggedVersesInChapterSelector,
  makeWordAnnotationsByChapterSelector,
  makeWordAnnotationsInOtherVersionsSelector,
} from '~redux/selectors/bible'
import { makeSelectBookmarksInChapter } from '~redux/selectors/bookmarks'
import { historyAtom, unifiedTagsModalAtom } from '../../state/app'
import {
  BibleTab,
  useBibleTabActions,
  VersionCode,
  parallelColumnWidthAtom,
  parallelDisplayModeAtom,
} from '../../state/tabs'
import AnnotationNoteModal from './AnnotationNoteModal'
import AnnotationToolbar from './AnnotationToolbar'
import { BibleDOMWrapper, ParallelVerse } from './BibleDOM/BibleDOMWrapper'
import BibleLinkModal from './BibleLinkModal'
import BibleNoteModal from './BibleNoteModal'
import BibleParamsModal from './BibleParamsModal'
import CrossVersionAnnotationsModal from './CrossVersionAnnotationsModal'
import BibleFooter from './footer/BibleFooter'
import { useAnnotationMode } from './hooks'
import { LoadingView } from './LoadingView'
import { OpenInNewTabButton } from './OpenInNewTabButton'
import ResourcesModal from './resources/ResourceModal'
import SelectedVersesModal from './SelectedVersesModal'
import StrongModal from './StrongModal'
import VerseNotesModal from './VerseNotesModal'
import VerseTagsModal from './VerseTagsModal'

const getPericopeChapter = (pericope: Pericope | null, book: number, chapter: number) => {
  if (pericope && pericope[book] && pericope[book][chapter]) {
    return pericope[book][chapter]
  }

  return {}
}

// Module-scope selectors - created once, memoization cache persists across renders
const selectHighlightsByChapter = makeHighlightsByChapterSelector()
const selectNotesByChapter = makeNotesByChapterSelector()
const selectLinksByChapter = makeLinksByChapterSelector()
const selectWordAnnotationsByChapter = makeWordAnnotationsByChapterSelector()
const selectSelectedVerseHighlightColor = makeSelectedVerseHighlightColorSelector()
const selectBookmarksInChapter = makeSelectBookmarksInChapter()
const selectWordAnnotationsInOtherVersions = makeWordAnnotationsInOtherVersionsSelector()
const selectTaggedVersesInChapter = makeTaggedVersesInChapterSelector()

interface BibleViewerProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  commentsDisplay?: boolean
  settings: RootState['user']['bible']['settings']
  onMountTimeout?: () => void
  isBibleViewReloadingAtom: PrimitiveAtom<boolean>
  withNavigation?: boolean
}

/**
 * Get localized error message based on error type
 */
const getErrorMessage = (error: BibleError, t: (key: string) => string): string => {
  switch (error.type) {
    case 'BIBLE_NOT_FOUND':
      return t('bible.error.versionNotFound')
    case 'CHAPTER_NOT_FOUND':
      return t('bible.error.chapterNotFound')
    case 'DATABASE_CORRUPTED':
      return t('bible.error.databaseCorrupted')
    default:
      return t('bible.error.unknown')
  }
}

const BibleViewer = ({
  bibleAtom,
  settings,
  onMountTimeout,
  isBibleViewReloadingAtom,
  withNavigation,
}: BibleViewerProps) => {
  const { t } = useTranslation()
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)

  const [error, setError] = useState<BibleError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [verses, setVerses] = useState<Verse[]>([])
  const [parallelVerses, setParallelVerses] = useState<ParallelVerse[]>([])
  const [secondaryVerses, setSecondaryVerses] = useState<Verse[] | null>(null)
  const [comments, setComments] = useState<{ [key: string]: string } | null>(null)
  const [redWords, setRedWords] = useState<Record<string, { start: number; end: number }[]> | null>(
    null
  )
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const [noteVerses, setNoteVerses] = useState<VerseIds | undefined>(undefined)
  const [linkVerses, setLinkVerses] = useState<VerseIds | undefined>(undefined)
  const strongModal = useBottomSheet()
  const [selectedCode, setSelectedCodeState] = useState<SelectedCode | null>(null)
  const bookmarkModalRef = useRef<BottomSheetModal>(null)
  const [selectedVerseForBookmark, setSelectedVerseForBookmark] = useState<{
    book: number
    chapter: number
    verse: number
  } | null>(null)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const bibleParamsModal = useBottomSheetModal()
  const resourceModal = useBottomSheet()
  const versesModal = useBottomSheet()
  const linkModal = useBottomSheetModal()
  const noteModal = useBottomSheetModal()

  // Annotation mode
  const annotationMode = useAnnotationMode()
  const annotationToolbar = useBottomSheet()
  const annotationNoteModal = useBottomSheetModal()

  // Cross-version annotations modal
  const crossVersionModal = useBottomSheetModal()
  const [crossVersionModalData, setCrossVersionModalData] = useState<{
    verseKey: string
    versions: CrossVersionAnnotation[]
  } | null>(null)
  const openInNewTab = useOpenInNewTab()

  // Verse tags modal
  const verseTagsModal = useBottomSheetModal()
  const [verseTagsModalKey, setVerseTagsModalKey] = useState<string | null>(null)

  // Verse notes modal
  const verseNotesModal = useBottomSheetModal()
  const [verseNotesModalKey, setVerseNotesModalKey] = useState<string | null>(null)

  // Add to study modal states
  const addToStudyModal = useBottomSheetModal()
  const verseFormatModal = useBottomSheetModal()
  const [pendingVerseData, setPendingVerseData] = useState<{
    studyId: string
    verseData: {
      title: string
      content: string
      version: string
      verses: string[]
    }
  } | null>(null)
  const addVerseToStudy = useAddVerseToStudy()

  const lang = useLanguage()
  const dispatch = useDispatch()
  const [pericope, setPericope] = useState<Pericope | null>(null)
  const [resourceType, onChangeResourceType] = useState<BibleResource>('strong')
  const addHistory = useSetAtom(historyAtom)
  const bible = useAtomValue(bibleAtom)
  const parallelColumnWidth = useAtomValue(parallelColumnWidthAtom)
  const parallelDisplayMode = useAtomValue(parallelDisplayModeAtom)
  const actions = useBibleTabActions(bibleAtom)

  const {
    data: {
      selectedVersion: version,
      selectedBook: book,
      selectedChapter: chapter,
      selectedVerse: verse,
      isReadOnly,
      isSelectionMode,
      focusVerses,
      parallelVersions,
      selectedVerses,
    },
  } = bible

  // Displayed values - updated only when verses are loaded to keep annotations in sync
  const [displayedBook, setDisplayedBook] = useState(book.Numero)
  const [displayedChapter, setDisplayedChapter] = useState(chapter)
  const [displayedVersion, setDisplayedVersion] = useState(version)

  // Handler for entering annotation mode (from SelectedVersesModal)
  const handleEnterAnnotationMode = useCallback(() => {
    // Clear selected verses and close the modal
    actions.clearSelectedVerses()
    versesModal.close()

    annotationMode.enterMode(version)
    annotationToolbar.open()
  }, [actions, versesModal, annotationMode, annotationToolbar, version])

  // Handler for entering annotation mode (from double-tap on verse)
  const handleEnterAnnotationModeFromDoubleTap = () => {
    annotationMode.enterMode(version)
    annotationToolbar.open()
  }

  // Handler for exiting annotation mode
  const handleExitAnnotationMode = useCallback(() => {
    // exitMode will auto-save any pending annotations
    annotationMode.exitMode()
    annotationToolbar.close()
  }, [annotationMode, annotationToolbar])

  // Handler for opening annotation note modal
  const handleAnnotationNotePress = useCallback(() => {
    if (!annotationMode.selectedAnnotation) return
    annotationNoteModal.open()
  }, [annotationMode.selectedAnnotation, annotationNoteModal])

  // Handler for opening annotation tags modal
  const handleAnnotationTagsPress = useCallback(() => {
    if (!annotationMode.selectedAnnotation) return
    setUnifiedTagsModal({
      mode: 'select',
      title: annotationMode.selectedAnnotation.text,
      id: annotationMode.selectedAnnotation.id,
      entity: 'wordAnnotations',
    })
  }, [annotationMode.selectedAnnotation, setUnifiedTagsModal])

  // Handler for deleting annotation with confirmation if it has a note or tags
  const handleDeleteAnnotation = useCallback(() => {
    if (!annotationMode.selectedAnnotation) return

    const hasNote = !!annotationMode.selectedAnnotation.noteId
    const hasTags = Object.keys(annotationMode.selectedAnnotation.tags || {}).length > 0

    if (hasNote || hasTags) {
      const warnings = []
      if (hasNote) warnings.push(t('une note'))
      if (hasTags) warnings.push(t('des tags'))

      Alert.alert(
        t('Attention'),
        t('Cette annotation a {{items}} associé(s). Voulez-vous vraiment la supprimer ?', {
          items: warnings.join(' ' + t('et') + ' '),
        }),
        [
          { text: t('Non'), style: 'cancel' },
          {
            text: t('Oui'),
            style: 'destructive',
            onPress: () => annotationMode.deleteSelectedAnnotation(),
          },
        ]
      )
    } else {
      annotationMode.deleteSelectedAnnotation()
    }
  }, [annotationMode, t])

  // Keep annotation mode's verses reference updated
  const { enabled: annotationModeEnabled, setVerses: setAnnotationVerses } = annotationMode
  useEffect(() => {
    if (annotationModeEnabled && verses.length > 0) {
      setAnnotationVerses(verses)
    }
  }, [verses, annotationModeEnabled, setAnnotationVerses])

  const selectAllVerses = () => {
    const selectedVersesToAdd: VerseIds = Object.fromEntries(
      verses.map(v => [`${v.Livre}-${v.Chapitre}-${v.Verset}`, true])
    )
    actions.selectAllVerses(selectedVersesToAdd)
  }

  // Open/close verses modal based on selected verses
  useEffect(() => {
    if (Object.keys(selectedVerses).length > 0) {
      versesModal.open()
    } else {
      versesModal.close()
    }
  }, [selectedVerses, versesModal])

  // Use displayed values for selectors to keep annotations in sync with verses
  const highlightedVersesByChapter = useSelector((state: RootState) =>
    selectHighlightsByChapter(state, displayedBook, displayedChapter)
  )

  const notesByChapter = useSelector((state: RootState) =>
    selectNotesByChapter(state, displayedBook, displayedChapter)
  )

  const linksByChapter = useSelector((state: RootState) =>
    selectLinksByChapter(state, displayedBook, displayedChapter)
  )

  const wordAnnotationsByChapter = useSelector((state: RootState) =>
    selectWordAnnotationsByChapter(state, displayedBook, displayedChapter, displayedVersion)
  )

  const selectedVerseHighlightColor = useSelector((state: RootState) =>
    selectSelectedVerseHighlightColor(state, selectedVerses)
  )

  const bookmarkedVerses = useSelector((state: RootState) =>
    selectBookmarksInChapter(state, displayedBook, displayedChapter)
  )

  const wordAnnotationsInOtherVersions = useSelector((state: RootState) =>
    selectWordAnnotationsInOtherVersions(state, displayedBook, displayedChapter, displayedVersion)
  )

  const taggedVersesData = useSelector((state: RootState) =>
    selectTaggedVersesInChapter(state, displayedBook, displayedChapter, displayedVersion)
  )
  const taggedVersesInChapter = taggedVersesData.counts
  const versesWithNonHighlightTags = taggedVersesData.hasNonHighlightTags

  const loadVerses = async () => {
    setIsLoading(true)

    // Load pericopes and main Bible version in parallel
    const [pericopeToLoad, mainResult] = await Promise.all([
      getBiblePericope(version),
      loadBibleChapter(book.Numero, chapter, version),
    ])

    // If main Bible version fails, set error and stop
    if (!mainResult.success || !mainResult.data) {
      setError(mainResult.error!)
      setIsLoading(false)
      return
    }

    const versesToLoad = mainResult.data as Verse[]

    // Load parallel versions in parallel - don't let one failure break others
    const parallelVersesToLoad: ParallelVerse[] = []
    if (parallelVersions.length) {
      const parallelResults = await Promise.all(
        parallelVersions.map(p => loadBibleChapter(book.Numero, chapter, p))
      )
      for (let i = 0; i < parallelVersions.length; i++) {
        const pResult = parallelResults[i]
        if (pResult.success && pResult.data) {
          parallelVersesToLoad.push({ id: parallelVersions[i], verses: pResult.data as Verse[] })
        } else {
          parallelVersesToLoad.push({ id: parallelVersions[i], verses: [], error: pResult.error })
        }
      }
    }

    // Load secondary verses for interlinear mode
    let secondaryVersesToLoad: Verse[] | null = null
    if (version === 'INT' || version === 'INT_EN') {
      const secondaryResult = await loadBibleChapter(
        book.Numero,
        chapter,
        getDefaultBibleVersion(lang)
      )
      if (secondaryResult.success && secondaryResult.data) {
        secondaryVersesToLoad = secondaryResult.data as Verse[]
      }
    }

    // Load comments if enabled
    if (settings.commentsDisplay) {
      const commentsToLoad = await loadMhyComments(book.Numero, chapter)
      setComments(JSON.parse(commentsToLoad.commentaires))
    } else if (comments) {
      setComments(null)
    }

    // Load red words data (memoized, fast on subsequent calls)
    loadRedWords(version)
      .then(setRedWords)
      .catch(() => setRedWords(null))

    // Update all states together to prevent UI flashes
    setIsLoading(false)
    setDisplayedBook(book.Numero)
    setDisplayedChapter(chapter)
    setDisplayedVersion(version)
    setPericope(pericopeToLoad)
    setVerses(versesToLoad)
    setParallelVerses(parallelVersesToLoad)
    setSecondaryVerses(secondaryVersesToLoad)
    setError(null)

    addHistory({
      book: book.Numero,
      chapter,
      verse,
      version,
      type: 'verse',
      date: Date.now(),
    })
    Sentry.addBreadcrumb({
      category: 'bible viewer',
      message: 'Load verses',
      data: { book: book.Numero, chapter, verse, version },
    })
  }

  const prevBook = usePrevious(book.Numero)
  const prevChapter = usePrevious(chapter)
  const parallelVersionsKey = parallelVersions.join(',')

  useEffect(() => {
    // Don't load verses if onboarding is not completed
    if (!isOnboardingCompleted) {
      return
    }
    loadVerses().catch(e => {
      console.log('[Bible] Error loading verses:', e)
      // Set a generic error if something unexpected happens
      setError({
        type: 'UNKNOWN_ERROR',
        version,
        book: book.Numero,
        chapter,
        message: e?.message || 'Unknown error',
      })
      setIsLoading(false)
    })

    // Only clear selected verses when book or chapter changes
    if (prevBook !== undefined && (prevBook !== book.Numero || prevChapter !== chapter)) {
      actions.clearSelectedVerses()
    }
  }, [book, chapter, version, parallelVersionsKey, isOnboardingCompleted, settings.commentsDisplay])

  const addHiglightAndOpenQuickTags = (color: string) => {
    dispatch(addHighlight({ color, selectedVerses }))
  }

  const addTag = () => {
    setUnifiedTagsModal({
      mode: 'select',
      entity: 'highlights',
      ids: selectedVerses,
    })
  }

  const toggleCreateNote = () => {
    setNoteVerses(selectedVerses)
    noteModal.open()
  }

  const toggleCreateLink = () => {
    setLinkVerses(selectedVerses)
    linkModal.open()
  }

  const openLinkModal = (linkId: string) => {
    try {
      const linkVersesToLoad = linkId.split('/').reduce((accuRefs, key) => {
        accuRefs[key] = true
        return accuRefs
      }, {} as VerseIds)
      setLinkVerses(linkVersesToLoad)
      linkModal.open()
    } catch (e) {
      const errorMessage = e instanceof Error ? e.toString() : String(e)
      Sentry.withScope(scope => {
        scope.setExtra('Error', errorMessage)
        scope.setExtra('Link', linkId)
        Sentry.captureMessage('Link corrupted')
      })
    }
  }

  const openNoteModal = (noteId: string) => {
    try {
      const noteVersesToLoad = noteId.split('/').reduce((accuRefs, key) => {
        accuRefs[key] = true
        return accuRefs
      }, {} as VerseIds)
      setNoteVerses(noteVersesToLoad)
      noteModal.open()
    } catch (e) {
      const errorMessage = e instanceof Error ? e.toString() : String(e)
      Sentry.withScope(scope => {
        scope.setExtra('Error', errorMessage)
        scope.setExtra('Note', noteId)
        Sentry.captureMessage('Note corrumpted')
      })
    }
  }

  const onChangeResourceTypeSelectVerse = (res: BibleResource, ver: string) => {
    actions.selectSelectedVerse(ver)
    onChangeResourceType(res)
    resourceModal.open()
  }

  // Add to study handlers
  const handleOpenAddToStudy = () => {
    addToStudyModal.open()
  }

  const handleSelectStudy = useCallback(
    async (studyId: string) => {
      // Capture verse data immediately when study is selected
      const { title, content } = await getVersesContent({
        verses: selectedVerses,
        version,
      })

      const verseData = {
        title,
        content,
        version,
        verses: Object.keys(selectedVerses),
      }

      setPendingVerseData({ studyId, verseData })
      verseFormatModal.open()
    },
    [selectedVerses, version, verseFormatModal]
  )

  const handleSelectFormat = useCallback(
    (format: 'inline' | 'block') => {
      if (!pendingVerseData) return

      addVerseToStudy(pendingVerseData.studyId, pendingVerseData.verseData, format)

      // Close both modals and reset state
      verseFormatModal.close()
      addToStudyModal.close()
      setPendingVerseData(null)
      actions.clearSelectedVerses()
    },
    [pendingVerseData, addVerseToStudy, verseFormatModal, addToStudyModal, actions]
  )

  // Pin verses handler - toggles focus on/off
  const handlePinVerses = () => {
    // Check if any selected verse is already in focus
    const selectedKeys = Object.keys(selectedVerses)
    const hasFocusActive =
      focusVerses?.some(v => selectedKeys.some(key => key.endsWith(`-${v}`))) ?? false

    if (hasFocusActive) {
      actions.clearFocusVerses()
    } else {
      actions.pinSelectedVerses()
    }
  }

  // Bookmark handler
  const handleAddBookmark = useCallback(() => {
    // Get the first selected verse for the bookmark
    const firstVerseKey = Object.keys(selectedVerses)[0]
    if (firstVerseKey) {
      const [bookNum, chapterNum, verseNum] = firstVerseKey.split('-').map(Number)
      setSelectedVerseForBookmark({
        book: bookNum,
        chapter: chapterNum,
        verse: verseNum,
      })
      setEditingBookmark(null)
      // Use setTimeout to ensure state is updated before presenting
      setTimeout(() => bookmarkModalRef.current?.present(), 0)
    }
  }, [selectedVerses, actions])

  // Handler for opening bookmark modal from DOM (existing bookmark)
  const handleOpenBookmarkModal = useCallback((bookmark: Bookmark) => {
    setEditingBookmark(bookmark)
    setSelectedVerseForBookmark(null)
    // Use setTimeout to ensure state is updated before presenting
    setTimeout(() => bookmarkModalRef.current?.present(), 0)
  }, [])

  const setSelectedCode = useCallback(
    (code: SelectedCode | null) => {
      setSelectedCodeState(code)
      if (code) {
        strongModal.open()
      }
    },
    [strongModal]
  )

  const clearSelectedCode = useCallback(() => {
    setSelectedCodeState(null)
  }, [])

  // Cross-version annotations modal handlers
  const handleOpenCrossVersionModal = useCallback(
    (verseKey: string, versions: CrossVersionAnnotation[]) => {
      setCrossVersionModalData({ verseKey, versions })
      crossVersionModal.open()
    },
    [crossVersionModal]
  )

  // Verse tags modal handler
  const handleOpenVerseTagsModal = useCallback(
    (verseKey: string) => {
      setVerseTagsModalKey(verseKey)
      verseTagsModal.open()
    },
    [verseTagsModal]
  )

  // Verse notes modal handler
  const handleOpenVerseNotesModal = useCallback(
    (verseKey: string) => {
      setVerseNotesModalKey(verseKey)
      verseNotesModal.open()
    },
    [verseNotesModal]
  )

  const handleCrossVersionSwitchVersion = useCallback(
    (newVersion: VersionCode, verse: number) => {
      actions.setSelectedVersion(newVersion)
      actions.setSelectedVerse(verse)
      crossVersionModal.close()
      setCrossVersionModalData(null)
    },
    [actions, crossVersionModal]
  )

  const handleCrossVersionOpenInNewTab = useCallback(
    (newVersion: VersionCode) => {
      openInNewTab(
        {
          ...bible,
          id: `bible-${generateUUID()}`,
          data: {
            ...bible.data,
            selectedVersion: newVersion,
            isReadOnly: false,
          },
        },
        {
          autoRedirect: true,
        }
      )
      crossVersionModal.close()
      setCrossVersionModalData(null)
    },
    [bible, openInNewTab, crossVersionModal]
  )

  // console.log('[Bible] BibleViewer', version, book.Numero, chapter, verse)

  // Wait for onboarding to complete before rendering Bible content
  // This prevents FileNotFoundException when Bible files don't exist yet
  if (!isOnboardingCompleted) {
    return (
      <Box flex={1} bg="reverse" center>
        <ActivityIndicator />
      </Box>
    )
  }

  return (
    <Box flex={1} bg="reverse">
      <BibleHeader
        bibleAtom={bibleAtom}
        onBibleParamsClick={bibleParamsModal.open}
        commentsDisplay={settings.commentsDisplay}
        hasBackButton={withNavigation}
        onExitAnnotationMode={handleExitAnnotationMode}
        annotationModeEnabled={annotationMode.enabled}
      />
      {error && <BibleErrorView error={error} t={t} />}
      {!error && verses.length > 0 && (
        <BibleDOMWrapper
          bibleAtom={bibleAtom}
          isBibleViewReloadingAtom={isBibleViewReloadingAtom}
          book={book}
          chapter={chapter}
          isLoading={isLoading}
          addSelectedVerse={actions.addSelectedVerse}
          removeSelectedVerse={actions.removeSelectedVerse}
          setSelectedVerse={actions.setSelectedVerse}
          version={version}
          isReadOnly={isReadOnly}
          isSelectionMode={isSelectionMode}
          verses={verses}
          parallelVerses={parallelVerses}
          parallelColumnWidth={parallelColumnWidth}
          parallelDisplayMode={parallelDisplayMode}
          focusVerses={focusVerses}
          secondaryVerses={secondaryVerses}
          selectedVerses={selectedVerses}
          highlightedVerses={highlightedVersesByChapter}
          notedVerses={notesByChapter}
          bookmarkedVerses={bookmarkedVerses}
          linkedVerses={linksByChapter}
          wordAnnotations={wordAnnotationsByChapter}
          settings={settings}
          verseToScroll={verse}
          pericopeChapter={getPericopeChapter(pericope, displayedBook, displayedChapter)}
          openNoteModal={openNoteModal}
          openLinkModal={openLinkModal}
          setSelectedCode={setSelectedCode}
          selectedCode={selectedCode}
          comments={comments}
          removeParallelVersion={actions.removeParallelVersion}
          addParallelVersion={actions.addParallelVersion}
          goToPrevChapter={actions.goToPrevChapter}
          goToNextChapter={actions.goToNextChapter}
          setUnifiedTagsModal={setUnifiedTagsModal}
          onChangeResourceTypeSelectVerse={onChangeResourceTypeSelectVerse}
          onMountTimeout={onMountTimeout}
          onOpenBookmarkModal={handleOpenBookmarkModal}
          exitReadOnlyMode={actions.exitReadOnlyMode}
          enterReadOnlyMode={actions.enterReadOnlyMode}
          clearFocusVerses={actions.clearFocusVerses}
          // Annotation mode props
          annotationMode={annotationMode.enabled}
          clearSelectionTrigger={annotationMode.clearSelectionTrigger}
          applyAnnotationTrigger={annotationMode.applyAnnotationTrigger}
          eraseSelectionTrigger={annotationMode.eraseSelectionTrigger}
          onSelectionChanged={annotationMode.handleSelectionChanged}
          onCreateAnnotation={annotationMode.handleCreateAnnotation}
          onEraseSelection={annotationMode.handleEraseSelection}
          onAnnotationSelected={annotationMode.handleAnnotationSelected}
          clearAnnotationSelectionTrigger={annotationMode.clearAnnotationSelectionTrigger}
          selectedAnnotationId={annotationMode.selectedAnnotation?.id ?? null}
          // Cross-version annotations
          wordAnnotationsInOtherVersions={wordAnnotationsInOtherVersions}
          onOpenCrossVersionModal={handleOpenCrossVersionModal}
          // Verse tags
          taggedVersesInChapter={taggedVersesInChapter}
          versesWithNonHighlightTags={versesWithNonHighlightTags}
          onOpenVerseTagsModal={handleOpenVerseTagsModal}
          // Verse notes modal
          onOpenVerseNotesModal={handleOpenVerseNotesModal}
          // Double-tap to enter annotation mode
          onEnterAnnotationMode={handleEnterAnnotationModeFromDoubleTap}
          // Red words
          redWords={settings.redWordsDisplay ? redWords : null}
        />
      )}
      {!(withNavigation || isReadOnly) && (
        <BibleFooter
          bibleAtom={bibleAtom}
          disabled={isLoading}
          book={book}
          chapter={chapter}
          goToPrevChapter={actions.goToPrevChapter}
          goToNextChapter={actions.goToNextChapter}
          goToChapter={actions.goToChapter}
          version={version}
        />
      )}
      {withNavigation && !error && <OpenInNewTabButton bibleTab={bible} />}
      <SelectedVersesModal
        ref={versesModal.getRef()}
        isSelectionMode={isSelectionMode}
        selectedVerseHighlightColor={selectedVerseHighlightColor}
        onChangeResourceType={val => {
          onChangeResourceType(val)
          resourceModal.open()
        }}
        onCreateNoteClick={toggleCreateNote}
        onCreateLinkClick={toggleCreateLink}
        addHighlight={addHiglightAndOpenQuickTags}
        addTag={addTag}
        removeHighlight={() => {
          // @ts-ignore
          dispatch(removeHighlight({ selectedVerses }))
        }}
        clearSelectedVerses={actions.clearSelectedVerses}
        selectedVerses={selectedVerses}
        selectAllVerses={selectAllVerses}
        version={version}
        onAddToStudy={handleOpenAddToStudy}
        onAddBookmark={handleAddBookmark}
        onPinVerses={handlePinVerses}
        onEnterAnnotationMode={parallelVersions.length > 0 ? undefined : handleEnterAnnotationMode}
        focusVerses={focusVerses}
      />
      <BibleNoteModal ref={noteModal.getRef()} noteVerses={noteVerses} />
      <BibleLinkModal ref={linkModal.getRef()} linkVerses={linkVerses} />
      <StrongModal
        ref={strongModal.getRef()}
        version={version}
        selectedCode={selectedCode}
        onClosed={clearSelectedCode}
      />

      <ResourcesModal
        resourceModalRef={resourceModal.getRef()}
        bibleAtom={bibleAtom}
        resourceType={resourceType}
        onChangeResourceType={onChangeResourceType}
        isSelectionMode={isSelectionMode}
      />
      <BibleParamsModal modalRef={bibleParamsModal.getRef()} />
      <AddToStudyModal
        bottomSheetRef={addToStudyModal.getRef()}
        onSelectStudy={handleSelectStudy}
      />
      <VerseFormatBottomSheet
        bottomSheetRef={verseFormatModal.getRef()}
        onSelectFormat={handleSelectFormat}
      />
      <LoadingView isBibleViewReloadingAtom={isBibleViewReloadingAtom} />
      <BookmarkModal
        bottomSheetRef={bookmarkModalRef}
        onClose={() => {
          setSelectedVerseForBookmark(null)
          setEditingBookmark(null)
        }}
        book={selectedVerseForBookmark?.book ?? editingBookmark?.book}
        chapter={selectedVerseForBookmark?.chapter ?? editingBookmark?.chapter}
        verse={selectedVerseForBookmark?.verse ?? editingBookmark?.verse}
        version={version}
        existingBookmark={editingBookmark || undefined}
      />
      <AnnotationToolbar
        ref={annotationToolbar.getRef()}
        hasSelection={annotationMode.hasSelection}
        selection={annotationMode.selection}
        onApplyAnnotation={annotationMode.applyAnnotation}
        onClearSelection={annotationMode.clearSelection}
        onEraseAnnotations={annotationMode.eraseSelection}
        onClose={handleExitAnnotationMode}
        selectedAnnotation={annotationMode.selectedAnnotation}
        onChangeAnnotationColor={annotationMode.changeAnnotationColor}
        onChangeAnnotationType={annotationMode.changeAnnotationType}
        onDeleteAnnotation={handleDeleteAnnotation}
        onClearAnnotationSelection={annotationMode.clearAnnotationSelection}
        onNotePress={handleAnnotationNotePress}
        onTagsPress={handleAnnotationTagsPress}
        tagsCount={Object.keys(annotationMode.selectedAnnotation?.tags || {}).length}
        isEnabled={annotationMode.enabled}
      />
      <AnnotationNoteModal
        ref={annotationNoteModal.getRef()}
        annotationId={annotationMode.selectedAnnotation?.id ?? null}
        annotationText={annotationMode.selectedAnnotation?.text ?? ''}
        annotationVerseKey={annotationMode.selectedAnnotation?.verseKey ?? ''}
        existingNoteId={annotationMode.selectedAnnotation?.noteId}
        version={version}
      />
      <CrossVersionAnnotationsModal
        bottomSheetRef={crossVersionModal.getRef()}
        verseKey={crossVersionModalData?.verseKey ?? null}
        versions={crossVersionModalData?.versions ?? []}
        onSwitchVersion={handleCrossVersionSwitchVersion}
        onOpenInNewTab={handleCrossVersionOpenInNewTab}
        onClose={() => setCrossVersionModalData(null)}
      />
      <VerseTagsModal
        ref={verseTagsModal.getRef()}
        verseKey={verseTagsModalKey}
        version={displayedVersion}
      />
      <VerseNotesModal ref={verseNotesModal.getRef()} verseKey={verseNotesModalKey} />
    </Box>
  )
}

const BibleErrorView = ({ error, t }: { error: BibleError; t: (key: string) => string }) => {
  const router = useRouter()
  const [isResetting, setIsResetting] = useState(false)
  const showActions = error.type === 'DATABASE_CORRUPTED' || error.type === 'BIBLE_NOT_FOUND'

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await resetBiblesDb()
      toast.success(t('bible.error.databaseRecovered'))
    } catch {
      toast.error(t('bible.error.databaseOpenFailed'))
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <Box flex={1} zIndex={-1}>
      <Empty source={require('~assets/images/empty.json')} message={getErrorMessage(error, t)}>
        {showActions && (
          <Box mt={20} gap={10} alignItems="center">
            <Button onPress={() => router.push('/downloads')}>
              {t('bible.error.goToDownloads')}
            </Button>
            {error.type === 'DATABASE_CORRUPTED' && (
              <Button secondary onPress={handleReset} isLoading={isResetting}>
                {t('bible.error.resetDatabase')}
              </Button>
            )}
          </Box>
        )}
      </Empty>
    </Box>
  )
}

export default BibleViewer
