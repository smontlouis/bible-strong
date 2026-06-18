import * as Sentry from '@sentry/react-native'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Platform, type LayoutChangeEvent } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import { useUnifiedTagsModal } from '~common/UnifiedTagsModalProvider'
import { BibleError } from '~helpers/bibleErrors'
import { usePrevious } from '~helpers/usePrevious'
import BibleHeader from './BibleHeader'

import { useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { PortalHost } from 'react-native-teleport'
import { type SheetRef } from '~common/sheet'
import type { Bookmark } from '~common/types'
import { BibleResource, Pericope, SelectedCode, Verse, VerseIds } from '~common/types'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import BookmarkModal from '~features/bookmarks/BookmarkModal'
import { useOpenNote } from '~features/notes/useOpenNote'
import AddToStudyModal from '~features/studies/AddToStudyModal'
import { useAddVerseToStudy } from '~features/studies/hooks/useAddVerseToStudy'
import VerseFormatSheet from '~features/studies/VerseFormatSheet'
import CreateEntityRelationModal from '~features/studyRelations/CreateEntityRelationModal'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { getBibleVersionCoverage } from '~helpers/biblesDb'
import generateUUID from '~helpers/generateUUID'
import getVersesContent from '~helpers/getVersesContent'
import { useQuery } from '~helpers/react-query-lite'
import useLanguage from '~helpers/useLanguage'
import { useSheet } from '~helpers/useSheet'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { RootState } from '~redux/modules/reducer'
import {
  addHighlight,
  createVerseEndpoint,
  removeHighlight,
  type RelationEndpoint,
} from '~redux/modules/user'
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
  selectLinks,
  selectNotes,
} from '~redux/selectors/bible'
import { makeSelectBookmarksInChapter } from '~redux/selectors/bookmarks'
import type { AppDispatch } from '~redux/store'
import { bibleDataRefreshSignalAtom, historyAtom } from '../../state/app'
import {
  activeBibleTabIdAtom,
  bibleDOMHostLayoutsAtom,
  BibleTab,
  getBibleContextDisplayMode,
  parallelColumnWidthAtom,
  parallelDisplayModeAtom,
  sharedBibleDOMPropsAtom,
  useBibleTabActions,
  VersionCode,
} from '../../state/tabs'
import AnnotationToolbar from './AnnotationToolbar'
import {
  BibleDOMWrapper,
  ParallelVerse,
  type StudyRelationsModalTarget,
} from './BibleDOM/BibleDOMWrapper'
import BibleParamsModal from './BibleParamsModal'
import {
  loadBibleReadingComments,
  loadBibleReadingMain,
  loadBibleReadingParallelVerses,
  loadBibleReadingRedWords,
  loadBibleReadingSecondaryVerses,
  RedWordsByVerse,
} from './bibleReadingChapter'
import CrossVersionAnnotationsModal from './CrossVersionAnnotationsModal'
import BibleFooter from './footer/BibleFooter'
import { useAnnotationMode } from './hooks'
import { LoadingView } from './LoadingView'
import ResourcesModal from './resources/ResourceModal'
import {
  getSelectedVerseKeys,
  getSelectedVersesBookmarkLocation,
  getSelectedVersesFocusAction,
  getSelectedVersesLinkParams,
  getSelectedVersesRelationEndpoint,
  getSelectedVersesStudyPayload,
  hasSelectedVerses,
  selectAllChapterVerses,
} from './selectedVersesActions'
import SelectedVersesModal from './SelectedVersesModal'
import { getBibleDOMDestination } from './SharedBibleDOM'
import SnapshotPlaceholder from './SnapshotPlaceholder'
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
  isFormSheet?: boolean
  isInTab?: boolean
}

const BibleViewer = ({
  bibleAtom,
  settings,
  onMountTimeout,
  isBibleViewReloadingAtom,
  isFormSheet,
  isInTab,
}: BibleViewerProps) => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const openEntityRelations = useOpenEntityRelations()
  const openNote = useOpenNote()
  const bibleDataRefreshSignal = useAtomValue(bibleDataRefreshSignalAtom)

  const [error, setError] = useState<BibleError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [verses, setVerses] = useState<Verse[]>([])
  const [parallelVerses, setParallelVerses] = useState<ParallelVerse[]>([])
  const [secondaryVerses, setSecondaryVerses] = useState<Verse[] | null>(null)
  const [comments, setComments] = useState<{ [key: string]: string } | null>(null)
  const [redWords, setRedWords] = useState<RedWordsByVerse | null>(null)
  const setUnifiedTagsModal = useUnifiedTagsModal()
  const [selectedCode, setSelectedCodeState] = useState<SelectedCode | null>(null)
  const bookmarkModalRef = useRef<SheetRef>(null)
  const [selectedVerseForBookmark, setSelectedVerseForBookmark] = useState<{
    book: number
    chapter: number
    verse: number
  } | null>(null)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const bibleParamsModal = useSheet()
  const resourceModal = useSheet()
  const versesModal = useSheet()
  const createRelationModal = useSheet()

  // Annotation mode
  const annotationMode = useAnnotationMode()
  const annotationToolbar = useSheet()

  // Cross-version annotations modal
  const crossVersionModal = useSheet()
  const [crossVersionModalData, setCrossVersionModalData] = useState<{
    verseKey: string
    versions: CrossVersionAnnotation[]
  } | null>(null)
  const openInNewTab = useOpenInNewTab()

  // Verse tags modal
  const verseTagsModal = useSheet()
  const [verseTagsModalKey, setVerseTagsModalKey] = useState<string | null>(null)

  const [createRelationSourceEndpoint, setCreateRelationSourceEndpoint] =
    useState<RelationEndpoint | null>(null)

  // Add to study modal states
  const addToStudyModal = useSheet()
  const verseFormatModal = useSheet()
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
  const [resourceModalSelection, setResourceModalSelection] = useState<{
    selectedVersion: VersionCode
    selectedVerses: VerseIds
  } | null>(null)
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
      isSelectionMode,
      focusVerses,
      parallelVersions,
      selectedVerses,
    },
  } = bible
  const contextDisplayMode = getBibleContextDisplayMode(bible.data)
  const isContextFocused = contextDisplayMode === 'focused'
  const selectedVersesReference = verseToReference(selectedVerses)
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
  const setBibleDOMHostLayouts = useSetAtom(bibleDOMHostLayoutsAtom)
  const isActiveBibleTab = !isFormSheet && activeBibleTabId === bible.id
  const useSharedDOM = Platform.OS === 'ios' ? false : isInTab
  const domLayerZIndex = Platform.OS === 'ios' ? 0 : -1

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
    const noteId = `annotation:${annotationMode.selectedAnnotation.id}`
    openNote({ noteId })
  }, [annotationMode.selectedAnnotation, openNote])

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
    if (hasSelectedVerses(selectedVerses)) {
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
  const allNotes = useSelector(selectNotes)

  const linksByChapter = useSelector((state: RootState) =>
    selectLinksByChapter(state, displayedBook, displayedChapter)
  )
  const allLinks = useSelector(selectLinks)

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

  const editFocusTags = () => {
    if (!focusVerses?.length) return

    setUnifiedTagsModal({
      mode: 'select',
      entity: 'highlights',
      ids: Object.fromEntries(
        focusVerses.map(focusVerse => [`${book.Numero}-${chapter}-${focusVerse}`, true])
      ),
    })
  }

  const toggleCreateNote = () => {
    const verseKeys = getSelectedVerseKeys(selectedVerses)
    openNote({ verseKeys })
  }

  const toggleCreateLink = () => {
    const params = getSelectedVersesLinkParams(selectedVerses)
    pushRouteOnce({
      pathname: '/link',
      params,
    })
  }

  const toggleCreateStudyRelation = () => {
    const endpoint = getSelectedVersesRelationEndpoint(selectedVerses)
    if (!endpoint) return
    setCreateRelationSourceEndpoint(endpoint)
    createRelationModal.open()
  }

  const handleRelationCreatedFromSelection = () => {
    createRelationModal.close()
    actions.clearSelectedVerses()
  }

  const openVerseStudyRelationsModal = (target: StudyRelationsModalTarget) => {
    const verseIds =
      typeof target === 'string'
        ? [target]
        : target.verseIds?.length
          ? target.verseIds
          : target.verseKey
            ? [target.verseKey]
            : []

    if (!verseIds.length) return

    openEntityRelations(createVerseEndpoint(verseIds))
  }

  const openLink = (linkId: string) => {
    pushRouteOnce({ pathname: '/link', params: { linkId } })
  }

  const openBibleNote = (noteId: string, verseIds?: string[]) => {
    openNote({ noteId, verseKeys: verseIds })
  }

  const openResourceForVerse = (res: BibleResource, ver: string) => {
    setResourceModalSelection({
      selectedVersion: version,
      selectedVerses: { [ver]: true },
    })
    onChangeResourceType(res)
    resourceModal.open()
  }

  const changeResourceModalVerse = (ver: string) => {
    if (resourceModalSelection) {
      setResourceModalSelection(current =>
        current ? { ...current, selectedVerses: { [ver]: true } } : current
      )
      return
    }

    actions.selectSelectedVerse(ver)
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
        verses: getSelectedVersesStudyPayload(selectedVerses),
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
    if (getSelectedVersesFocusAction(selectedVerses, focusVerses) === 'clear-focus') {
      actions.clearFocusVerses()
    } else {
      actions.pinSelectedVerses()
    }
  }

  // Bookmark handler
  const handleAddBookmark = useCallback(() => {
    const location = getSelectedVersesBookmarkLocation(selectedVerses)
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
        pushRouteOnce({
          pathname: '/strong',
          params: {
            book: String(code.book),
            reference: code.reference,
          },
        })
      }
    },
    [pushRouteOnce]
  )

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
            contextDisplayMode: 'fullChapter',
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
    tabId: bible.id,
    bibleAtom,
    isBibleViewReloadingAtom,
    book,
    chapter,
    isLoading,
    addSelectedVerse: actions.addSelectedVerse,
    removeSelectedVerse: actions.removeSelectedVerse,
    setSelectedVerse: actions.setSelectedVerse,
    version,
    contextDisplayMode,
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
    allNotes,
    bookmarkedVerses,
    linkedVerses: linksByChapter,
    allLinks,
    studyRelations: studyRelationsByChapter,
    wordAnnotations: wordAnnotationsByChapter,
    settings,
    verseToScroll: verse,
    pericopeChapter: getPericopeChapter(pericope, displayedBook, displayedChapter),
    openNote: openBibleNote,
    openLink,
    setSelectedCode,
    selectedCode,
    comments,
    removeParallelVersion: actions.removeParallelVersion,
    addParallelVersion: actions.addParallelVersion,
    goToPrevChapter: goToPrevAvailableChapter,
    goToNextChapter: goToNextAvailableChapter,
    setUnifiedTagsModal,
    onOpenResourceForVerse: openResourceForVerse,
    onMountTimeout,
    onOpenBookmarkModal: handleOpenBookmarkModal,
    expandContext: actions.expandContext,
    collapseContext: actions.collapseContext,
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
    onOpenStudyRelationsModal: openVerseStudyRelationsModal,
    // Double-tap to enter annotation mode
    onEnterAnnotationMode: handleEnterAnnotationModeFromDoubleTap,
    // Red words
    redWords: settings.redWordsDisplay ? redWords : null,
    isFormSheet,
    error,
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
      setBibleDOMHostLayouts(current => {
        if (!current[bible.id]) return current
        const next = { ...current }
        delete next[bible.id]
        return next
      })
    }
  }, [useSharedDOM, bible.id, setBibleDOMHostLayouts])

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

  const handleBibleDOMHostLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (!useSharedDOM) return

    const width = Math.round(layout.width)
    const height = Math.round(layout.height)
    if (width <= 0 || height <= 0) return

    setBibleDOMHostLayouts(current => {
      const previous = current[bible.id]
      if (previous?.width === width && previous?.height === height) return current

      Sentry.addBreadcrumb({
        category: 'bible-host',
        message: 'PortalHost layout changed',
        data: { tabId: bible.id, width, height },
        level: 'info',
      })

      return { ...current, [bible.id]: { width, height } }
    })
  }

  return (
    <Box flex={1} bg="reverse">
      <BibleHeader
        bibleAtom={bibleAtom}
        onBibleParamsClick={bibleParamsModal.open}
        commentsDisplay={settings.commentsDisplay}
        isFormSheet={isFormSheet}
        isInTab={isInTab}
        onExitAnnotationMode={handleExitAnnotationMode}
        annotationModeEnabled={annotationMode.enabled}
        onEditFocusTags={editFocusTags}
      />
      <Box flex={1} zIndex={domLayerZIndex}>
        {useSharedDOM ? (
          // Keep every host mounted so Android only retargets between
          // stable native parents instead of unmounting/remounting hosts.
          <Box flex={1} onLayout={handleBibleDOMHostLayout}>
            <PortalHost
              name={getBibleDOMDestination(bible.id)}
              style={{ flex: 1, zIndex: domLayerZIndex }}
            />
            {!isActiveBibleTab && (
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <SnapshotPlaceholder base64={bible.base64Preview} />
              </Box>
            )}
          </Box>
        ) : (
          // Stack navigation mode: render own BibleDOMWrapper inline
          <BibleDOMWrapper {...domProps} />
        )}
      </Box>
      {!isFormSheet && !isContextFocused && (
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
      <SelectedVersesModal
        ref={versesModal.getRef()}
        isSelectionMode={isSelectionMode}
        selectedVerseHighlightColor={selectedVerseHighlightColor}
        onChangeResourceType={val => {
          setResourceModalSelection(null)
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
      <CreateEntityRelationModal
        ref={createRelationModal.getRef()}
        sourceEndpoint={createRelationSourceEndpoint}
        onCreated={handleRelationCreatedFromSelection}
      />
      <ResourcesModal
        resourceModalRef={resourceModal.getRef()}
        bibleAtom={bibleAtom}
        resourceType={resourceType}
        onChangeResourceType={onChangeResourceType}
        isSelectionMode={isSelectionMode}
        selectedVersion={resourceModalSelection?.selectedVersion}
        selectedVerses={resourceModalSelection?.selectedVerses}
        onChangeVerse={changeResourceModalVerse}
      />
      <BibleParamsModal modalRef={bibleParamsModal.getRef()} />
      <AddToStudyModal
        sheetRef={addToStudyModal.getRef()}
        onSelectStudy={handleSelectStudy}
        reference={selectedVersesReference}
      />
      <VerseFormatSheet
        sheetRef={verseFormatModal.getRef()}
        onSelectFormat={handleSelectFormat}
        reference={pendingVerseData?.verseData.title || selectedVersesReference}
      />
      <LoadingView isBibleViewReloadingAtom={isBibleViewReloadingAtom} />
      <BookmarkModal
        sheetRef={bookmarkModalRef}
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
      <CrossVersionAnnotationsModal
        sheetRef={crossVersionModal.getRef()}
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
    </Box>
  )
}

export default BibleViewer
