import * as Sentry from '@sentry/react-native'
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Platform, type LayoutChangeEvent } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import { useUnifiedTagsModal } from '~common/UnifiedTagsModalProvider'
import { BibleError, BibleLoadingError } from '~helpers/bibleErrors'
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
import { useResourceAccess } from '~features/resources/resourceAccess'
import { bibleChapterQueryOptions, loadBibleVerseTexts } from '~features/resources/resourceQueries'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { osisToBibleReferenceTarget } from '~helpers/bcvParser'
import { getBook } from '~helpers/bibleBookCatalog'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import generateUUID from '~helpers/generateUUID'
import getVersesContent from '~helpers/getVersesContent'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { localQueryOptions } from '~helpers/queryOptions'
import type { StrongSelection } from '~helpers/strongSelection'
import useLanguage from '~helpers/useLanguage'
import { useSheet } from '~helpers/useSheet'
import { toast } from '~helpers/toast'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { RootState } from '~redux/modules/reducer'
import {
  addHighlight,
  createVerseEndpoint,
  isContextualInformationDisplayEnabled,
  removeHighlight,
  setSettingsContextualInformationDisplay,
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
import { selectIsLogged } from '~redux/selectors/user'
import type { AppDispatch } from '~redux/store'
import { historyAtom } from '../../state/app'
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
import { selectBibleTabVersion } from '~helpers/bibleTabVersionSelection'
import {
  BibleDOMWrapper,
  type BibleDOMDownloadState,
  type StudyRelationsModalTarget,
} from './BibleDOM/BibleDOMWrapper'
import BibleParamsModal from './BibleParamsModal'
import {
  loadBibleReadingComments,
  loadBibleReadingParallelVerses,
  loadBibleReadingRedWords,
} from './bibleReadingChapter'
import { getCanonicalChapterPericope } from '~helpers/canonicalBibleHeadings'
import { usesCanonicalBibleExtras } from '~helpers/strongBiblePublications'
import CrossVersionAnnotationsModal from './CrossVersionAnnotationsModal'
import BibleFooter from './footer/BibleFooter'
import { useAnnotationMode } from './hooks'
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
import CanonicalBibleNoteSheet from './CanonicalBibleNoteSheet'
import StrongSelectionSheet from './StrongSelectionSheet'
import {
  getBibleViewerPersonalData,
  shouldHideBibleViewerPersonalData,
} from './bibleViewerPersonalData'
import {
  getStrongSelectionDOMContextKey,
  getStrongSelectionRelationItemsKey,
  getStrongSelectionRenderedContentKey,
  shouldDismissStrongSelectionForViewerState,
} from './strongSelectionLifecycle'

const getPericopeChapter = (pericope: Pericope | null, book: number, chapter: number) => {
  if (pericope && pericope[book] && pericope[book][chapter]) {
    return pericope[book][chapter]
  }

  return {}
}

const EMPTY_VERSES: Verse[] = []

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
  isFormSheet?: boolean
  isInTab?: boolean
}

const BibleViewer = ({ bibleAtom, settings, isFormSheet, isInTab }: BibleViewerProps) => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const openEntityRelations = useOpenEntityRelations()
  const openNote = useOpenNote()
  const resources = useResourceAccess()

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
  const canonicalBibleNoteModal = useSheet()
  const [canonicalBibleNote, setCanonicalBibleNote] = useState<CanonicalBibleNote | null>(null)
  const strongSelectionModal = useSheet()
  const strongSelectionModalRef = strongSelectionModal.getRef()
  const [strongSelectionData, setStrongSelectionData] = useState<StrongSelection | null>(null)

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
  const isLogged = useSelector(selectIsLogged)
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
      strongMode,
      interlinearMode,
      interlinearLocale,
      selectedBook: book,
      selectedChapter: chapter,
      selectedVerse: verse,
      isSelectionMode,
      focusVerses,
      parallelVersions,
      selectedVerses,
    },
  } = bible
  const hidePersonalBibleData = shouldHideBibleViewerPersonalData({
    version,
    strongMode,
    interlinearMode,
  })
  const contextDisplayMode = getBibleContextDisplayMode(bible.data)
  const isContextFocused = contextDisplayMode === 'focused'
  const selectedVersesReference = verseToReference(selectedVerses)
  const { data: coverageData } = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(version),
    queryFn: () => resources.bibleContent.loadCoverage(version),
    enabled: !!version,
    ...localQueryOptions,
  })
  const goToPrevAvailableChapter = () => actions.goToPrevChapter(coverageData)
  const goToNextAvailableChapter = () => actions.goToNextChapter(coverageData)

  const mainChapterRequest = {
    book: book.Numero,
    chapter,
    version,
    strongMode,
    interlinearMode,
    interlinearLocale: interlinearLocale ?? lang,
    interlinearLocaleAutomatic: !interlinearLocale,
  }
  const mainReadingQuery = useQuery({
    ...bibleChapterQueryOptions(mainChapterRequest, resources),
    placeholderData: keepPreviousData,
  })
  const mainResult = mainReadingQuery.data
  const verses = mainResult?.success && mainResult.data ? mainResult.data.verses : EMPTY_VERSES
  const legacyPericopeQuery = useQuery({
    queryKey: resourceQueryKeys.biblePericope(version),
    queryFn: () => resources.bibleReading.loadPericope(version),
    enabled: Boolean(mainResult?.success && mainResult.data && !usesCanonicalBibleExtras(version)),
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const pericope =
    mainResult?.success && mainResult.data && usesCanonicalBibleExtras(version)
      ? getCanonicalChapterPericope(mainResult.data.verses)
      : (legacyPericopeQuery.data ?? null)
  const isLoading = mainReadingQuery.isFetching
  const resultError = mainResult?.success === false ? mainResult.error : undefined
  const error: BibleError | null = resultError
    ? resultError
    : mainReadingQuery.error
      ? mainReadingQuery.error instanceof BibleLoadingError
        ? {
            type: mainReadingQuery.error.type,
            version: mainReadingQuery.error.version,
            book: mainReadingQuery.error.book,
            chapter: mainReadingQuery.error.chapter,
            message: mainReadingQuery.error.message,
          }
        : {
            type: 'UNKNOWN_ERROR',
            version,
            book: book.Numero,
            chapter,
            message:
              mainReadingQuery.error instanceof Error
                ? mainReadingQuery.error.message
                : 'Unknown error',
          }
      : null

  const extrasRequest = {
    book: book.Numero,
    chapter,
    version,
    strongMode,
    interlinearLocale: interlinearLocale ?? lang,
    interlinearLocaleAutomatic: !interlinearLocale,
    parallelVersions,
    commentsDisplay: settings.commentsDisplay,
  }
  const extrasEnabled =
    Boolean(mainResult?.success && mainResult.data) && !mainReadingQuery.isPlaceholderData
  const contextualInformationDisplay = isContextualInformationDisplayEnabled(
    settings.contextualInformationDisplay
  )
  const { data: parallelVerses = [] } = useQuery({
    queryKey: resourceQueryKeys.bibleParallel({
      book: book.Numero,
      chapter,
      versions: parallelVersions,
      strongMode,
      interlinearLocale: interlinearLocale ?? lang,
      interlinearLocaleAutomatic: !interlinearLocale,
    }),
    queryFn: () => loadBibleReadingParallelVerses(extrasRequest, resources),
    enabled: extrasEnabled,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const commentsQuery = useQuery({
    queryKey: resourceQueryKeys.bibleComments({ book: book.Numero, chapter, language: lang }),
    queryFn: () => loadBibleReadingComments(extrasRequest, resources),
    enabled: extrasEnabled && settings.commentsDisplay,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const comments = settings.commentsDisplay ? (commentsQuery.data ?? null) : null
  const { data: redWords = null } = useQuery({
    queryKey: resourceQueryKeys.bibleRedWords(version),
    queryFn: () => loadBibleReadingRedWords(extrasRequest, resources),
    enabled: extrasEnabled,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const displayedChapterEntityStrongCodes = [
    ...new Set(
      verses.flatMap(verse =>
        (verse.StrongSpans ?? []).flatMap(span => span.identities.map(identity => identity.code))
      )
    ),
  ]
  const chapterStrongCodesQuery = useQuery({
    queryKey: resourceQueryKeys.strongBibleChapterCodes({
      currentVersionId: version,
      defaultVersionId: settings.defaultStrongBibleVersionId ?? 'LSG',
      book: book.Numero,
      chapter,
    }),
    queryFn: () =>
      resources.strongBible.loadChapterCodes({
        currentVersionId: version,
        defaultVersionId: settings.defaultStrongBibleVersionId ?? 'LSG',
        book: book.Numero,
        chapter,
      }),
    enabled: extrasEnabled && contextualInformationDisplay && !isContextFocused,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const chapterEntityStrongCodes =
    chapterStrongCodesQuery.data?.status === 'available'
      ? chapterStrongCodesQuery.data.codes
      : displayedChapterEntityStrongCodes
  const chapterEntityAvailabilityQuery = useQuery({
    queryKey: ['strong-lexicon', 'availability', 'entities'],
    queryFn: () => resources.strongLexicon.getModuleAvailability('entities'),
    enabled: contextualInformationDisplay,
    networkMode: 'always',
  })
  const chapterEntityDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'entities' })
  )
  const chapterEntityDownloadState: BibleDOMDownloadState = {
    status: chapterEntityDownload?.status,
    progress: chapterEntityDownload
      ? chapterEntityDownload.status === 'inserting'
        ? 0.8 + chapterEntityDownload.insertProgress * 0.2
        : chapterEntityDownload.downloadProgress * 0.8
      : 0,
    error: chapterEntityDownload?.error,
  }
  const refetchChapterEntityAvailability = useEffectEvent(() => {
    void chapterEntityAvailabilityQuery.refetch()
  })
  useEffect(() => {
    if (chapterEntityDownload?.status === 'completed') refetchChapterEntityAvailability()
  }, [chapterEntityDownload?.status])
  const chapterEntityModuleStatus =
    contextualInformationDisplay && !isContextFocused
      ? (chapterEntityAvailabilityQuery.data?.status ?? null)
      : null
  const chapterEntitiesAvailable =
    contextualInformationDisplay &&
    !isContextFocused &&
    chapterEntityAvailabilityQuery.data?.status === 'available'
  const chapterEntitiesQuery = useQuery({
    queryKey: [
      'strong-lexicon',
      'chapter-entities',
      lang,
      book.Numero,
      chapter,
      chapterEntityStrongCodes.join(','),
    ],
    queryFn: () =>
      resources.strongLexicon.loadChapterEntities(
        book.Numero,
        chapter,
        lang,
        chapterEntityStrongCodes
      ),
    enabled: extrasEnabled && chapterEntitiesAvailable,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const chapterEntities = chapterEntitiesQuery.data ?? []
  const chapterEntitiesLoaded = chapterEntitiesQuery.isSuccess

  // Shared Bible DOM: detect if this tab is the active Bible tab
  const activeBibleTabId = useAtomValue(activeBibleTabIdAtom)
  const setSharedProps = useSetAtom(sharedBibleDOMPropsAtom)
  const setBibleDOMHostLayouts = useSetAtom(bibleDOMHostLayoutsAtom)
  const isActiveBibleTab = !isFormSheet && activeBibleTabId === bible.id
  const useSharedDOM = Platform.OS === 'ios' ? false : isInTab
  const domLayerZIndex = -1
  const strongSelectionRenderedContentKey = getStrongSelectionRenderedContentKey(
    verses,
    parallelVerses
  )

  // Displayed values - updated only when verses are loaded to keep annotations in sync
  const [displayedBook, setDisplayedBook] = useState(book.Numero)
  const [displayedChapter, setDisplayedChapter] = useState(chapter)
  const [displayedVersion, setDisplayedVersion] = useState(version)

  // Handler for entering annotation mode (from SelectedVersesModal)
  const handleEnterAnnotationMode = useCallback(() => {
    if (hidePersonalBibleData) return
    // Clear selected verses and close the modal
    actions.clearSelectedVerses()
    versesModal.close()

    annotationMode.enterMode(version)
    annotationToolbar.open()
  }, [actions, versesModal, annotationMode, annotationToolbar, version, hidePersonalBibleData])

  // Handler for entering annotation mode (from double-tap on verse)
  const handleEnterAnnotationModeFromDoubleTap = () => {
    if (hidePersonalBibleData) return
    annotationMode.enterMode(version)
    annotationToolbar.open()
  }

  // Handler for exiting annotation mode
  const handleExitAnnotationMode = useCallback(() => {
    // exitMode will auto-save pending annotations
    annotationMode.exitMode()
    annotationToolbar.close()
  }, [annotationMode, annotationToolbar])

  const clearHiddenPersonalBibleState = useEffectEvent(() => {
    if (hasSelectedVerses(selectedVerses)) {
      actions.clearSelectedVerses()
    }
    versesModal.close()
    if (annotationMode.enabled) {
      annotationMode.exitMode()
      annotationToolbar.close()
    }
  })

  useEffect(() => {
    if (hidePersonalBibleData) clearHiddenPersonalBibleState()
  }, [hidePersonalBibleData])

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
  const strongSelectionDOMContextKey = getStrongSelectionDOMContextKey({
    version,
    book: book.Numero,
    chapter,
    strongMode,
    interlinearMode,
    interlinearLocale: interlinearLocale ?? lang,
    parallelVersions,
    focusVerses,
    contextDisplayMode,
    renderedContentKey: strongSelectionRenderedContentKey,
    relationItemsKey: getStrongSelectionRelationItemsKey(studyRelationsByChapter),
    annotationModeEnabled: annotationMode.enabled,
    strongRelationItemsVisible:
      (settings.relationsDisplay || 'inline') === 'inline' && !isSelectionMode,
  })
  const previousStrongSelectionDOMContextKey = usePrevious(strongSelectionDOMContextKey)

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
  const recordedHistoryKeyRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (mainReadingQuery.isPlaceholderData || !mainResult?.success || !mainResult.data) {
      return
    }
    const historyKey = `${version}:${book.Numero}:${chapter}:${mainReadingQuery.dataUpdatedAt}`
    if (recordedHistoryKeyRef.current === historyKey) return
    recordedHistoryKeyRef.current = historyKey

    setDisplayedBook(book.Numero)
    setDisplayedChapter(chapter)
    setDisplayedVersion(version)
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
  }, [
    addHistory,
    book.Numero,
    chapter,
    mainReadingQuery.dataUpdatedAt,
    mainReadingQuery.isPlaceholderData,
    mainResult,
    verse,
    version,
  ])

  const prevBook = usePrevious(book.Numero)
  const prevChapter = usePrevious(chapter)

  useEffect(() => {
    // Only clear selected verses when book or chapter changes
    if (prevBook !== undefined && (prevBook !== book.Numero || prevChapter !== chapter)) {
      actions.clearSelectedVerses()
    }
  }, [actions, book.Numero, chapter, prevBook, prevChapter])

  const addHiglightAndOpenQuickTags = (color: string) => {
    dispatch(addHighlight({ color, selectedVerses, version }))
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
    openNote({ verseKeys, version })
  }

  const toggleCreateLink = () => {
    const params = getSelectedVersesLinkParams(selectedVerses, version)
    pushRouteOnce({
      pathname: '/link',
      params,
    })
  }

  const toggleCreateStudyRelation = () => {
    const endpoint = getSelectedVersesRelationEndpoint(selectedVerses, version)
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

    openEntityRelations(createVerseEndpoint(verseIds, undefined, version))
  }

  const openLink = (linkId: string) => {
    pushRouteOnce({ pathname: '/link', params: { linkId } })
  }

  const openBibleNote = (noteId: string, verseIds?: string[]) => {
    openNote({ noteId, verseKeys: verseIds, version })
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
    if (!isLogged) {
      toast.info(t('study.loginRequired'))
      return
    }

    addToStudyModal.open()
  }

  const handleSelectStudy = useCallback(
    async (studyId: string) => {
      // Capture verse data immediately when study is selected
      const { title, content } = await getVersesContent({
        verses: selectedVerses,
        version,
        loadVerseTexts: (versionId, verseKeys) =>
          loadBibleVerseTexts(resources, versionId, verseKeys),
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
    [resources, selectedVerses, version, verseFormatModal]
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

  const setSelectedCode = (selection: StrongSelection) => {
    if (
      strongSelectionData?.occurrenceId &&
      strongSelectionData.occurrenceId === selection.occurrenceId
    ) {
      setSelectedCodeState(null)
      strongSelectionModal.close()
      return
    }

    setSelectedCodeState(selection)
    setStrongSelectionData(selection)
    strongSelectionModal.open()
  }

  const closeStrongSelection = () => {
    setSelectedCodeState(null)
    setStrongSelectionData(null)
  }

  const startClosingStrongSelection = () => {
    setSelectedCodeState(null)
  }

  const dismissStrongSelection = useEffectEvent(() => {
    if (!strongSelectionData) return

    setSelectedCodeState(null)
    strongSelectionModal.close()
  })

  useEffect(() => {
    if (
      previousStrongSelectionDOMContextKey !== undefined &&
      previousStrongSelectionDOMContextKey !== strongSelectionDOMContextKey
    ) {
      dismissStrongSelection()
    }
  }, [previousStrongSelectionDOMContextKey, strongSelectionDOMContextKey])

  useEffect(() => {
    if (shouldDismissStrongSelectionForViewerState({ isActiveBibleTab, isFormSheet, isInTab })) {
      dismissStrongSelection()
    }
  }, [isActiveBibleTab, isFormSheet, isInTab])

  useLayoutEffect(
    () => () => {
      strongSelectionModalRef.current?.dismiss()
    },
    [strongSelectionModalRef]
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

  const handleOpenCanonicalBibleNote = (note: CanonicalBibleNote) => {
    setCanonicalBibleNote(note)
    canonicalBibleNoteModal.open()
  }

  const handleCanonicalBibleReferencePress = (osis: string) => {
    const target = osisToBibleReferenceTarget(osis)
    if (!target) return

    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify(getBook(target.book)),
        chapter: String(target.chapter),
        verse: String(target.verse),
        ...(target.focusVerses ? { focusVerses: JSON.stringify(target.focusVerses) } : {}),
      },
    })
  }

  const handleCrossVersionOpenInNewTab = useCallback(
    (newVersion: VersionCode) => {
      openInNewTab(
        {
          ...bible,
          id: `bible-${generateUUID()}`,
          data: selectBibleTabVersion(
            {
              ...bible.data,
              contextDisplayMode: 'fullChapter',
            },
            newVersion
          ),
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

  // Apply the mode policy before personal Bible data crosses the DOM bridge.
  const viewerPersonalData = getBibleViewerPersonalData(hidePersonalBibleData, {
    isSelectionMode,
    selectedVerses,
    highlightedVerses: highlightedVersesByChapter,
    notedVerses: notesByChapter,
    allNotes,
    bookmarkedVerses,
    linkedVerses: linksByChapter,
    allLinks,
    studyRelations: studyRelationsByChapter,
    wordAnnotations: wordAnnotationsByChapter,
    annotationMode: annotationMode.enabled,
    wordAnnotationsInOtherVersions,
    taggedVersesInChapter,
    versesWithNonHighlightTags,
  })

  const domProps = {
    tabId: bible.id,
    bibleAtom,
    book,
    chapter,
    isLoading,
    personalBibleDataEnabled: !hidePersonalBibleData,
    addSelectedVerse: hidePersonalBibleData ? () => undefined : actions.addSelectedVerse,
    removeSelectedVerse: hidePersonalBibleData ? () => undefined : actions.removeSelectedVerse,
    setSelectedVerse: actions.setSelectedVerse,
    version,
    interlinearMode,
    contextDisplayMode,
    isSelectionMode: viewerPersonalData.isSelectionMode,
    verses,
    parallelVerses,
    parallelColumnWidth,
    parallelDisplayMode,
    focusVerses,
    selectedVerses: viewerPersonalData.selectedVerses,
    highlightedVerses: viewerPersonalData.highlightedVerses,
    notedVerses: viewerPersonalData.notedVerses,
    allNotes: viewerPersonalData.allNotes,
    bookmarkedVerses: viewerPersonalData.bookmarkedVerses,
    linkedVerses: viewerPersonalData.linkedVerses,
    allLinks: viewerPersonalData.allLinks,
    studyRelations: viewerPersonalData.studyRelations,
    wordAnnotations: viewerPersonalData.wordAnnotations,
    settings,
    verseToScroll: verse,
    pericopeChapter: getPericopeChapter(pericope, displayedBook, displayedChapter),
    openNote: hidePersonalBibleData ? undefined : openBibleNote,
    openLink: hidePersonalBibleData ? undefined : openLink,
    setSelectedCode,
    selectedCode,
    comments,
    removeParallelVersion: actions.removeParallelVersion,
    addParallelVersion: actions.addParallelVersion,
    goToPrevChapter: goToPrevAvailableChapter,
    goToNextChapter: goToNextAvailableChapter,
    setUnifiedTagsModal: hidePersonalBibleData ? undefined : setUnifiedTagsModal,
    onOpenResourceForVerse: openResourceForVerse,
    onOpenBookmarkModal: hidePersonalBibleData ? undefined : handleOpenBookmarkModal,
    onOpenCanonicalBibleReference: handleCanonicalBibleReferencePress,
    expandContext: actions.expandContext,
    collapseContext: actions.collapseContext,
    clearFocusVerses: actions.clearFocusVerses,
    // Annotation mode props
    annotationMode: viewerPersonalData.annotationMode,
    clearSelectionTrigger: annotationMode.clearSelectionTrigger,
    applyAnnotationTrigger: annotationMode.applyAnnotationTrigger,
    eraseSelectionTrigger: annotationMode.eraseSelectionTrigger,
    onSelectionChanged: hidePersonalBibleData ? undefined : annotationMode.handleSelectionChanged,
    onCreateAnnotation: hidePersonalBibleData ? undefined : annotationMode.handleCreateAnnotation,
    onEraseSelection: hidePersonalBibleData ? undefined : annotationMode.handleEraseSelection,
    onAnnotationSelected: hidePersonalBibleData
      ? undefined
      : annotationMode.handleAnnotationSelected,
    clearAnnotationSelectionTrigger: annotationMode.clearAnnotationSelectionTrigger,
    selectedAnnotationId: annotationMode.selectedAnnotation?.id ?? null,
    // Cross-version annotations
    wordAnnotationsInOtherVersions: viewerPersonalData.wordAnnotationsInOtherVersions,
    onOpenCrossVersionModal: hidePersonalBibleData ? undefined : handleOpenCrossVersionModal,
    // Verse tags
    taggedVersesInChapter: viewerPersonalData.taggedVersesInChapter,
    versesWithNonHighlightTags: viewerPersonalData.versesWithNonHighlightTags,
    onOpenVerseTagsModal: hidePersonalBibleData ? undefined : handleOpenVerseTagsModal,
    onOpenCanonicalBibleNote: handleOpenCanonicalBibleNote,
    onOpenStudyRelationsModal: hidePersonalBibleData ? undefined : openVerseStudyRelationsModal,
    // Double-tap to enter annotation mode
    onEnterAnnotationMode: hidePersonalBibleData
      ? undefined
      : handleEnterAnnotationModeFromDoubleTap,
    // Red words
    redWords: settings.redWordsDisplay ? redWords : null,
    chapterEntities,
    chapterEntitiesLoaded,
    chapterEntityModuleStatus,
    chapterEntityDownloadState,
    onDisableContextualInformation: () => dispatch(setSettingsContextualInformationDisplay(false)),
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
        annotationModeEnabled={annotationMode.enabled && !hidePersonalBibleData}
        hidePersonalBibleData={hidePersonalBibleData}
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
      {!hidePersonalBibleData && (
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
          onEnterAnnotationMode={
            parallelVersions.length > 0 ? undefined : handleEnterAnnotationMode
          }
          focusVerses={focusVerses}
        />
      )}
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
        isEnabled={annotationMode.enabled && !hidePersonalBibleData}
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
      <CanonicalBibleNoteSheet
        sheetRef={canonicalBibleNoteModal.getRef()}
        note={canonicalBibleNote}
        onReferencePress={handleCanonicalBibleReferencePress}
      />
      <StrongSelectionSheet
        sheetRef={strongSelectionModalRef}
        version={strongSelectionData?.version}
        book={strongSelectionData?.book}
        chapter={strongSelectionData?.chapter}
        verse={strongSelectionData?.verse}
        word={strongSelectionData?.word}
        identities={strongSelectionData?.identities ?? []}
        morphologies={strongSelectionData?.morphologies ?? []}
        onDismissStart={startClosingStrongSelection}
        onClose={closeStrongSelection}
      />
    </Box>
  )
}

export default BibleViewer
