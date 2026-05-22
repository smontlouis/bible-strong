import * as Sentry from '@sentry/react-native'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { BibleError } from '~helpers/bibleErrors'
import BibleErrorView from './BibleErrorView'
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
import { getBibleVersionCoverage } from '~helpers/biblesDb'
import generateUUID from '~helpers/generateUUID'
import getVersesContent from '~helpers/getVersesContent'
import { useQuery } from '~helpers/react-query-lite'
import { useBottomSheet, useBottomSheetModal } from '~helpers/useBottomSheet'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'
import {
  addHighlight,
  createStudyRelation,
  createVerseEndpoint,
  removeHighlight,
  type RelationEndpoint,
} from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import {
  CrossVersionAnnotation,
  makeHighlightsByChapterSelector,
  makeLinksByChapterSelector,
  makeNotesByChapterSelector,
  makeSelectedVerseHighlightColorSelector,
  makeStudyRelationsByChapterSelector,
  makeTaggedVersesInChapterSelector,
  makeWordAnnotationsByChapterSelector,
  makeWordAnnotationsInOtherVersionsSelector,
} from '~redux/selectors/bible'
import { makeSelectBookmarksInChapter } from '~redux/selectors/bookmarks'
import { historyAtom, unifiedTagsModalAtom, bibleDataRefreshSignalAtom } from '../../state/app'
import {
  BibleTab,
  useBibleTabActions,
  VersionCode,
  parallelColumnWidthAtom,
  parallelDisplayModeAtom,
  activeBibleTabIdAtom,
  sharedBibleDOMPropsAtom,
} from '../../state/tabs'
import { PortalHost } from 'react-native-teleport'
import { getBibleDOMDestination } from './SharedBibleDOM'
import SnapshotPlaceholder from './SnapshotPlaceholder'
import AnnotationNoteModal from './AnnotationNoteModal'
import AnnotationToolbar from './AnnotationToolbar'
import { BibleDOMWrapper, ParallelVerse } from './BibleDOM/BibleDOMWrapper'
import {
  loadBibleReadingComments,
  loadBibleReadingMain,
  loadBibleReadingParallelVerses,
  loadBibleReadingRedWords,
  loadBibleReadingSecondaryVerses,
  RedWordsByVerse,
} from './bibleReadingChapter'
import {
  getFirstSelectedVerseLocation,
  selectAllChapterVerses,
  selectedVersesIncludeFocus,
} from './selectedVersesActions'
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
import EntityRelationsModal from '~features/studyRelations/EntityRelationsModal'
import StudyRelationTargetPickerModal from '~features/studyRelations/StudyRelationTargetPickerModal'

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
const selectStudyRelationsByChapter = makeStudyRelationsByChapterSelector()
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

const BibleViewer = ({
  bibleAtom,
  settings,
  onMountTimeout,
  isBibleViewReloadingAtom,
  withNavigation,
}: BibleViewerProps) => {
  const { t } = useTranslation()
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const bibleDataRefreshSignal = useAtomValue(bibleDataRefreshSignalAtom)

  const [error, setError] = useState<BibleError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [verses, setVerses] = useState<Verse[]>([])
  const [parallelVerses, setParallelVerses] = useState<ParallelVerse[]>([])
  const [secondaryVerses, setSecondaryVerses] = useState<Verse[] | null>(null)
  const [comments, setComments] = useState<{ [key: string]: string } | null>(null)
  const [redWords, setRedWords] = useState<RedWordsByVerse | null>(null)
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
  const relationTargetPickerModal = useBottomSheetModal()

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
  const verseStudyRelationsModal = useBottomSheetModal()
  const [verseStudyRelationsModalKey, setVerseStudyRelationsModalKey] = useState<string | null>(
    null
  )
  const [relationSourceEndpoint, setRelationSourceEndpoint] = useState<RelationEndpoint | null>(
    null
  )

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
  const dispatch = useDispatch<AppDispatch>()
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
  const { data: coverageData } = useQuery({
    queryKey: ['bible-version-coverage', version],
    queryFn: () => getBibleVersionCoverage(version),
    enabled: !!version,
  })
  const goToPrevAvailableChapter = () => actions.goToPrevChapter(coverageData)
  const goToNextAvailableChapter = () => actions.goToNextChapter(coverageData)

  // Shared Bible DOM: detect if this tab is the active Bible tab
  const activeBibleTabId = useAtomValue(activeBibleTabIdAtom)
  const setSharedProps = useSetAtom(sharedBibleDOMPropsAtom)
  const isActiveBibleTab = !withNavigation && activeBibleTabId === bible.id
  const useSharedDOM = !withNavigation

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
    // exitMode will auto-save pending annotations
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
    actions.selectAllVerses(selectAllChapterVerses(verses))
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

  const studyRelationsByChapter = useSelector((state: RootState) =>
    selectStudyRelationsByChapter(state, displayedBook, displayedChapter)
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

  // Guard against stale background hydration results after chapter change
  const loadIdRef = useRef(0)

  const loadVerses = async () => {
    setIsLoading(true)
    const currentLoadId = ++loadIdRef.current

    // Phase 1: Load main verses + pericopes (critical path)
    const { pericope: pericopeToLoad, mainResult } = await loadBibleReadingMain({
      book: book.Numero,
      chapter,
      version,
    })

    // If main Bible version fails, set error and stop
    if (!mainResult.success || !mainResult.data) {
      setError(mainResult.error!)
      setIsLoading(false)
      return
    }

    // Stale check after async
    if (loadIdRef.current !== currentLoadId) return

    const versesToLoad = mainResult.data as Verse[]

    // Display main verses immediately
    setIsLoading(false)
    setDisplayedBook(book.Numero)
    setDisplayedChapter(chapter)
    setDisplayedVersion(version)
    setPericope(pericopeToLoad)
    setVerses(versesToLoad)
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

    // Phase 2: Hydrate secondary data in background (non-blocking)
    const extrasRequest = {
      book: book.Numero,
      chapter,
      version,
      parallelVersions,
      commentsDisplay: settings.commentsDisplay,
      lang,
    }

    // Parallel versions
    loadBibleReadingParallelVerses(extrasRequest).then(parallelVersesToLoad => {
      if (loadIdRef.current !== currentLoadId) return
      setParallelVerses(parallelVersesToLoad)
    })

    // Secondary verses for interlinear mode
    loadBibleReadingSecondaryVerses(extrasRequest).then(secondaryVersesToLoad => {
      if (loadIdRef.current !== currentLoadId) return
      setSecondaryVerses(secondaryVersesToLoad)
    })

    // Comments
    loadBibleReadingComments(extrasRequest)
      .then(commentsToLoad => {
        if (loadIdRef.current !== currentLoadId) return
        setComments(commentsToLoad)
      })
      .catch(() => {
        if (loadIdRef.current !== currentLoadId) return
        setComments(null)
      })

    // Red words (memoized, fast on subsequent calls)
    loadBibleReadingRedWords(extrasRequest)
      .then(redWordsToLoad => {
        if (loadIdRef.current !== currentLoadId) return
        setRedWords(redWordsToLoad)
      })
      .catch(() => setRedWords(null))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    book,
    chapter,
    version,
    parallelVersionsKey,
    isOnboardingCompleted,
    settings.commentsDisplay,
    bibleDataRefreshSignal,
  ])

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

  const toggleCreateStudyRelation = () => {
    const verseKeys = Object.keys(selectedVerses)
    if (!verseKeys.length) return
    setRelationSourceEndpoint(createVerseEndpoint(verseKeys))
    relationTargetPickerModal.open()
  }

  const createRelationToTarget = (targetEndpoint: RelationEndpoint) => {
    if (!relationSourceEndpoint) return
    dispatch(
      createStudyRelation({
        endpoints: [relationSourceEndpoint, targetEndpoint],
      })
    )
    relationTargetPickerModal.close()
    actions.clearSelectedVerses()
  }

  const openVerseStudyRelationsModal = (verseKey: string) => {
    setVerseStudyRelationsModalKey(verseKey)
    verseStudyRelationsModal.open()
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
    if (selectedVersesIncludeFocus(selectedVerses, focusVerses)) {
      actions.clearFocusVerses()
    } else {
      actions.pinSelectedVerses()
    }
  }

  // Bookmark handler
  const handleAddBookmark = useCallback(() => {
    const location = getFirstSelectedVerseLocation(selectedVerses)
    if (location) {
      setSelectedVerseForBookmark({
        book: location.book,
        chapter: location.chapter,
        verse: location.verse,
      })
      setEditingBookmark(null)
      // Use setTimeout to ensure state is updated before presenting
      setTimeout(() => bookmarkModalRef.current?.present(), 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Build the props object for BibleDOMWrapper (same props as before, just extracted)
  const domProps = {
    bibleAtom,
    isBibleViewReloadingAtom,
    book,
    chapter,
    isLoading,
    addSelectedVerse: actions.addSelectedVerse,
    removeSelectedVerse: actions.removeSelectedVerse,
    setSelectedVerse: actions.setSelectedVerse,
    version,
    isReadOnly,
    isSelectionMode,
    verses,
    parallelVerses,
    parallelColumnWidth,
    parallelDisplayMode,
    focusVerses,
    secondaryVerses,
    selectedVerses,
    highlightedVerses: highlightedVersesByChapter,
    notedVerses: notesByChapter,
    bookmarkedVerses,
    linkedVerses: linksByChapter,
    studyRelations: studyRelationsByChapter,
    wordAnnotations: wordAnnotationsByChapter,
    settings,
    verseToScroll: verse,
    pericopeChapter: getPericopeChapter(pericope, displayedBook, displayedChapter),
    openNoteModal,
    openLinkModal,
    setSelectedCode,
    selectedCode,
    comments,
    removeParallelVersion: actions.removeParallelVersion,
    addParallelVersion: actions.addParallelVersion,
    goToPrevChapter: goToPrevAvailableChapter,
    goToNextChapter: goToNextAvailableChapter,
    setUnifiedTagsModal,
    onChangeResourceTypeSelectVerse,
    onMountTimeout,
    onOpenBookmarkModal: handleOpenBookmarkModal,
    exitReadOnlyMode: actions.exitReadOnlyMode,
    enterReadOnlyMode: actions.enterReadOnlyMode,
    clearFocusVerses: actions.clearFocusVerses,
    // Annotation mode props
    annotationMode: annotationMode.enabled,
    clearSelectionTrigger: annotationMode.clearSelectionTrigger,
    applyAnnotationTrigger: annotationMode.applyAnnotationTrigger,
    eraseSelectionTrigger: annotationMode.eraseSelectionTrigger,
    onSelectionChanged: annotationMode.handleSelectionChanged,
    onCreateAnnotation: annotationMode.handleCreateAnnotation,
    onEraseSelection: annotationMode.handleEraseSelection,
    onAnnotationSelected: annotationMode.handleAnnotationSelected,
    clearAnnotationSelectionTrigger: annotationMode.clearAnnotationSelectionTrigger,
    selectedAnnotationId: annotationMode.selectedAnnotation?.id ?? null,
    // Cross-version annotations
    wordAnnotationsInOtherVersions,
    onOpenCrossVersionModal: handleOpenCrossVersionModal,
    // Verse tags
    taggedVersesInChapter,
    versesWithNonHighlightTags,
    onOpenVerseTagsModal: handleOpenVerseTagsModal,
    // Verse notes modal
    onOpenVerseNotesModal: handleOpenVerseNotesModal,
    onOpenStudyRelationsModal: openVerseStudyRelationsModal,
    // Double-tap to enter annotation mode
    onEnterAnnotationMode: handleEnterAnnotationModeFromDoubleTap,
    // Red words
    redWords: settings.redWordsDisplay ? redWords : null,
  } satisfies Parameters<typeof BibleDOMWrapper>[0]

  // Push props to shared atom when this is the active Bible tab.
  useLayoutEffect(() => {
    if (!useSharedDOM) return
    if (isActiveBibleTab) {
      setSharedProps(domProps)
    }
  })

  // Exit annotation mode when this tab becomes inactive
  useEffect(() => {
    if (useSharedDOM && !isActiveBibleTab && annotationMode.enabled) {
      handleExitAnnotationMode()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveBibleTab])

  // Track PortalHost lifecycle for Sentry (context for native Android crashes)
  useEffect(() => {
    if (!useSharedDOM) return
    Sentry.addBreadcrumb({
      category: 'bible-host',
      message: 'PortalHost mount',
      data: { tabId: bible.id },
      level: 'info',
    })
    return () => {
      Sentry.addBreadcrumb({
        category: 'bible-host',
        message: 'PortalHost unmount',
        data: { tabId: bible.id },
        level: 'info',
      })
    }
  }, [useSharedDOM, bible.id])

  // Track tab activation changes for Sentry
  useEffect(() => {
    if (!useSharedDOM) return
    Sentry.addBreadcrumb({
      category: 'bible-host',
      message: `Tab ${isActiveBibleTab ? 'activated' : 'deactivated'}`,
      data: { tabId: bible.id },
      level: 'info',
    })
  }, [useSharedDOM, isActiveBibleTab, bible.id])

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
      <Box flex={1} zIndex={-1}>
        {useSharedDOM ? (
          // Keep every host mounted so Android only retargets between
          // stable native parents instead of unmounting/remounting hosts.
          <Box flex={1}>
            <PortalHost name={getBibleDOMDestination(bible.id)} style={{ flex: 1, zIndex: -1 }} />
            {!isActiveBibleTab && (
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <SnapshotPlaceholder base64={bible.base64Preview} />
              </Box>
            )}
          </Box>
        ) : (
          // Stack navigation mode: render own BibleDOMWrapper inline
          !error && <BibleDOMWrapper {...domProps} />
        )}
        {error && (
          <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="reverse" zIndex={10}>
            <BibleErrorView error={error} />
          </Box>
        )}
      </Box>
      {!(withNavigation || isReadOnly) && (
        <BibleFooter
          bibleAtom={bibleAtom}
          disabled={isLoading}
          book={book}
          chapter={chapter}
          coverage={coverageData}
          goToPrevChapter={goToPrevAvailableChapter}
          goToNextChapter={goToNextAvailableChapter}
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
        onCreateStudyRelationClick={toggleCreateStudyRelation}
        addHighlight={addHiglightAndOpenQuickTags}
        addTag={addTag}
        removeHighlight={() => {
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
      <StudyRelationTargetPickerModal
        ref={relationTargetPickerModal.getRef()}
        onSelect={createRelationToTarget}
      />
      <EntityRelationsModal
        ref={verseStudyRelationsModal.getRef()}
        endpoint={
          verseStudyRelationsModalKey ? createVerseEndpoint([verseStudyRelationsModalKey]) : null
        }
        onCreateRelation={() => {
          if (!verseStudyRelationsModalKey) return
          setRelationSourceEndpoint(createVerseEndpoint([verseStudyRelationsModalKey]))
          verseStudyRelationsModal.close()
          relationTargetPickerModal.open()
        }}
      />
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

export default BibleViewer
