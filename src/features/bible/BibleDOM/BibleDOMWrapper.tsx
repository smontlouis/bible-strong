import { useTheme } from '@emotion/react'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import produce from 'immer'
import { useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isBibleOverlayOpenAtom, isFullScreenBibleAtom } from 'src/state/app'
import { selectBibleTabVersion } from '~helpers/bibleTabVersionSelection'
import {
  BibleContextDisplayMode,
  BibleTab,
  ParallelColumnWidth,
  ParallelDisplayMode,
  VersionCode,
} from 'src/state/tabs'
import BibleDOMComponent from './BibleDOMComponent'
import {
  sortVersesToTags,
  getAnnotationNotesInfo,
  getVerseRelationsMetadata,
  transformComments,
} from './computeVerseMetadata'
import booksJson from '~assets/bible_versions/books.json'
import { Book } from '~assets/bible_versions/books-desc'
import type { Bookmark } from '~common/types'
import {
  BibleResource,
  Pericope,
  SelectedCode,
  Tag,
  Verse,
  VerseIds,
  StudyNavigateBibleType,
} from '~common/types'
import Box from '~common/ui/Box'
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
} from '~features/app-switcher/utils/constants'
import { HelpTip } from '~features/tips/HelpTip'
import { appLogger } from '~helpers/agentObservability'
import { BibleError } from '~helpers/bibleErrors'
import type { InterlinearMode } from '~helpers/interlinearDisplayMode'
import { toast } from '~helpers/toast'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { RootState } from '~redux/modules/reducer'
import {
  HighlightsObj,
  LinksObj,
  NotesObj,
  StudyRelationsObj,
  WordAnnotationsObj,
} from '~redux/modules/user'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import type { RelationEndpoint, RelationKind, RelationType } from '~features/studyRelations/domain'
import { useOpenRelationEndpoint } from '~features/studyRelations/useOpenRelationEndpoint'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { createStrongIdentity } from '~helpers/strongIdentities'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useBookAndVersionSelector } from '../BookSelectorSheet/BookSelectorSheetProvider'
import type { AnnotationType, SelectionRange, WordPosition } from '../hooks/useAnnotationMode'
import { BibleDOMTranslations } from './TranslationsContext'
import {
  ADD_PARALLEL_VERSION,
  ANNOTATION_SELECTED,
  CLEAR_FOCUS_VERSES,
  CREATE_ANNOTATION,
  ENTER_ANNOTATION_MODE,
  COLLAPSE_CONTEXT,
  DOWNLOAD_BIBLE_VERSION,
  ERASE_SELECTION,
  EXPAND_CONTEXT,
  NAVIGATE_TO_BIBLE_LINK,
  NAVIGATE_TO_BIBLE_NOTE,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_BIBLICAL_ENTITY,
  NAVIGATE_TO_STRONG,
  DOWNLOAD_CHAPTER_ENTITIES,
  DISMISS_CONTEXTUAL_INFORMATION,
  NAVIGATE_TO_BIBLE_VIEW,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_RELATION_ENDPOINT,
  OPEN_STRONG_SELECTION,
  NAVIGATE_TO_TAG,
  NAVIGATE_TO_VERSE_LINKS,
  NAVIGATE_TO_VERSE_STUDY_RELATIONS,
  NAVIGATE_TO_VERSION,
  OPEN_BOOKMARK_MODAL,
  OPEN_CANONICAL_BIBLE_NOTE,
  OPEN_CANONICAL_BIBLE_REFERENCE,
  OPEN_CROSS_VERSION_MODAL,
  OPEN_HIGHLIGHT_TAGS,
  OPEN_VERSE_TAGS_MODAL,
  OPEN_DOWNLOADS,
  REMOVE_PARALLEL_VERSION,
  RESET_BIBLE_DATABASE,
  RETRY_BIBLE_RESOURCE,
  SET_BIBLE_OVERLAY_OPEN,
  SELECTION_CHANGED,
  SHOW_TOAST,
  SWIPE_DOWN,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  SWIPE_UP,
  TOGGLE_SELECTED_VERSE,
  isPersonalBibleDataAction,
} from './dispatch'
import {
  getBookmarkPayload,
  getCanonicalBibleNotePayload,
  getNoteNavigationPayload,
  getNumberPayload,
  getStrongRelationSelectionPayload,
  getStringPayload,
  getStudyRelationsModalTarget,
  getToastPayload,
  getVerseIdsPayload,
  isRecord,
  type BibleDOMBridgeAction,
  type StudyRelationsModalTarget,
} from './bibleDomBridgeCommands'
import AndroidWebViewWarningModal from '../AndroidWebViewWarningModal'
import { downloadManager } from '~helpers/downloadManager'
import {
  createBibleDownloadItem,
  createStrongLexiconModuleDownloadPlan,
} from '~helpers/downloadItemFactory'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { resetBiblesDb } from '~helpers/biblesDb'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import { getStrongSelectionPayload, type StrongSelection } from '~helpers/strongSelection'
import type { ResolvedPassageMediaChapter } from '../passageMedia'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'

export type { StudyRelationsModalTarget } from './bibleDomBridgeCommands'

export type ParallelVerse = {
  id: VersionCode
  verses: Verse[]
  error?: BibleError
  interlinearMode?: InterlinearMode
}

export type TaggedVerse = {
  lastVerse: string
  tags: Tag[]
  date: number
  color: string
  verseIds: string[]
}

export type RootStyles = {
  settings: RootState['user']['bible']['settings']
}

export type PericopeChapter = Pericope[string][string]

type HighlightTagsModalPayload = {
  mode: 'select'
  entity: 'highlights'
  ids: Record<string, true>
}

export type Dispatch = (props: BibleDOMBridgeAction) => Promise<void>

const books = booksJson as Record<string, string[]>

/**
 * Prevents rapid empty→loaded prop updates on the Expo DOM bridge.
 * Skips updates when loading with no verses, so the DOM component
 * only receives the real data once it's ready.
 */
function useStabilizedVerses(verses: Verse[], isLoading: boolean) {
  const [stable, setStable] = useState<Verse[]>(verses)

  useEffect(() => {
    if (isLoading && verses.length === 0) return
    setStable(verses)
  }, [verses, isLoading])

  return stable
}

const DOM_WEBVIEW_BACKGROUND_COLOR = 'transparent'
const DOM_WEBVIEW_INITIAL_SCRIPT =
  "document.documentElement.style.backgroundColor='transparent';document.body.style.backgroundColor='transparent';document.body.style.margin='0';true;"

export type WebViewProps = {
  tabId: string
  bibleAtom: PrimitiveAtom<BibleTab>
  book: Book
  chapter: number
  isLoading: boolean
  personalBibleDataEnabled?: boolean
  addSelectedVerse: (id: string) => void
  removeSelectedVerse: (id: string) => void
  setSelectedVerse: (selectedVerse: number) => void
  version: VersionCode
  interlinearMode?: InterlinearMode
  contextDisplayMode: BibleContextDisplayMode
  isSelectionMode: StudyNavigateBibleType | undefined
  verses: Verse[]
  parallelVerses: ParallelVerse[]
  parallelColumnWidth?: ParallelColumnWidth
  parallelDisplayMode?: ParallelDisplayMode

  focusVerses: (string | number)[] | undefined
  selectedVerses: VerseIds
  highlightedVerses: HighlightsObj
  notedVerses: NotesObj
  allNotes: NotesObj
  bookmarkedVerses: Record<number, Bookmark>
  linkedVerses: LinksObj
  allLinks: LinksObj
  studyRelations: StudyRelationsObj
  wordAnnotations: WordAnnotationsObj
  settings: RootState['user']['bible']['settings']
  verseToScroll: number | undefined
  pericopeChapter: PericopeChapter
  passageMedia: ResolvedPassageMediaChapter
  openNote?: (noteId: string, verseIds?: string[]) => void
  openLink?: (linkId: string) => void
  setSelectedCode: (selectedCode: StrongSelection) => void
  selectedCode: SelectedCode | null
  comments: { [key: string]: string } | null
  removeParallelVersion?: (index: number) => void
  addParallelVersion?: () => void
  goToPrevChapter?: () => void
  goToNextChapter?: () => void
  setUnifiedTagsModal?: (payload: HighlightTagsModalPayload) => void
  onOpenResourceForVerse?: (resourceType: BibleResource, verseKey: string) => void
  onOpenBookmarkModal?: (bookmark: Bookmark) => void
  onOpenCanonicalBibleReference?: (osis: string) => void
  expandContext?: () => void
  collapseContext?: () => void
  clearFocusVerses?: () => void
  // Annotation mode props
  annotationMode?: boolean
  clearSelectionTrigger?: number
  applyAnnotationTrigger?: { count: number; color: string; type: AnnotationType }
  eraseSelectionTrigger?: number
  // Annotation mode handlers
  onSelectionChanged?: (hasSelection: boolean, selection: SelectionRange | null) => void
  onCreateAnnotation?: (payload: {
    ranges: { verseKey: string; startWordIndex: number; endWordIndex: number; text: string }[]
    color: string
    type: AnnotationType
  }) => void
  onEraseSelection?: (payload: { start: WordPosition; end: WordPosition }) => void
  onAnnotationSelected?: (annotationId: string | null) => void
  clearAnnotationSelectionTrigger?: number
  selectedAnnotationId?: string | null
  // Cross-version annotations
  wordAnnotationsInOtherVersions?: Record<string, CrossVersionAnnotation[]>
  onOpenCrossVersionModal?: (verseKey: string, versions: CrossVersionAnnotation[]) => void
  // Verse tags
  taggedVersesInChapter?: Record<number, number>
  versesWithNonHighlightTags?: Record<number, boolean>
  onOpenVerseTagsModal?: (verseKey: string) => void
  onOpenCanonicalBibleNote?: (note: CanonicalBibleNote) => void
  onOpenStudyRelationsModal?: (target: StudyRelationsModalTarget) => void
  isFormSheet?: boolean
  // Enter annotation mode from double-tap
  onEnterAnnotationMode?: () => void
  // Red words data
  redWords?: Record<string, { start: number; end: number }[]> | null
  chapterEntities: StrongLexiconChapterEntity[]
  chapterEntitiesLoaded: boolean
  chapterEntityModuleStatus: StrongLexiconModuleAvailability['status'] | null
  chapterEntityDownloadState: BibleDOMDownloadState
  onDisableContextualInformation?: () => void
  error?: BibleError | null
}

export type BibleDOMDownloadState = {
  status?: 'queued' | 'downloading' | 'inserting' | 'completed' | 'failed' | 'cancelled'
  progress: number
  error?: string
}

export type NotedVerse = {
  id?: string
  title: string
  description: string
  date: number
  tags?: {
    [x: string]: Tag
  }
  key: string
  verses: string
  verseIds: string[]
}

export type LinkedVerse = {
  id?: string
  url: string
  title: string
  linkType: string
  date: number
  tags?: {
    [x: string]: Tag
  }
  key: string
  verses: string
}

export type VerseRelationItem = {
  key: string
  relationId: string
  relationType: RelationType
  relationKind: RelationKind
  targetEndpoint: RelationEndpoint
  targetType: RelationEndpoint['type']
  label: string
  targetIsAvailable: boolean
  targetEntityExists: boolean
  verseIds: string[]
  updatedAt: number
}

export const BibleDOMWrapper = ({
  verses,
  parallelVerses,
  parallelColumnWidth = 75,
  parallelDisplayMode = 'horizontal',
  focusVerses,
  selectedVerses,
  highlightedVerses,
  notedVerses,
  allNotes,
  bookmarkedVerses,
  linkedVerses,
  allLinks,
  studyRelations,
  wordAnnotations,
  settings,
  verseToScroll,
  contextDisplayMode,
  version,
  interlinearMode,
  pericopeChapter,
  passageMedia,
  book,
  chapter,
  isSelectionMode,
  selectedCode,
  comments,
  annotationMode,
  clearSelectionTrigger,
  applyAnnotationTrigger,
  eraseSelectionTrigger,
  clearAnnotationSelectionTrigger,
  selectedAnnotationId,
  wordAnnotationsInOtherVersions,
  taggedVersesInChapter,
  versesWithNonHighlightTags,
  onOpenResourceForVerse,
  onOpenStudyRelationsModal,
  onOpenCanonicalBibleReference,
  openNote,
  openLink,
  removeParallelVersion,
  addParallelVersion,
  setSelectedCode,
  removeSelectedVerse,
  addSelectedVerse,
  expandContext,
  collapseContext,
  clearFocusVerses,
  onSelectionChanged,
  onCreateAnnotation,
  onEraseSelection,
  onAnnotationSelected,
  onOpenBookmarkModal,
  onOpenCrossVersionModal,
  onOpenVerseTagsModal,
  onOpenCanonicalBibleNote,
  setUnifiedTagsModal,
  bibleAtom,
  goToPrevChapter,
  goToNextChapter,
  onEnterAnnotationMode,
  isFormSheet,
  redWords,
  chapterEntities,
  chapterEntitiesLoaded,
  chapterEntityModuleStatus,
  chapterEntityDownloadState,
  onDisableContextualInformation,
  isLoading,
  personalBibleDataEnabled = true,
  error,
}: WebViewProps) => {
  const isConnected = useConnection()
  const { openVersionSelector } = useBookAndVersionSelector()
  const openRelationEndpoint = useOpenRelationEndpoint()
  const isContextFocused = contextDisplayMode === 'focused'
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)
  const setIsBibleOverlayOpen = useSetAtom(isBibleOverlayOpenAtom)
  const isBibleOverlayOpenRef = useRef(false)
  const wasFullScreenBeforeOverlayRef = useRef(false)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const pushRouteOnce = usePushRouteOnce()
  const [isResettingDatabase, setIsResettingDatabase] = useState(false)
  const errorDownloadItemId = createOfflineCopyId({
    kind: 'bible',
    versionId: error?.version ?? version,
  })
  const queueState = useDownloadItemStatus(errorDownloadItemId)
  const errorDownloadState: BibleDOMDownloadState | undefined = error
    ? {
        status: queueState?.status,
        progress:
          queueState?.status === 'inserting'
            ? (queueState.insertProgress ?? 0)
            : (queueState?.downloadProgress ?? 0),
        error: queueState?.error,
      }
    : undefined

  const stableVerses = useStabilizedVerses(verses, isLoading)

  useEffect(
    () => () => {
      if (!isBibleOverlayOpenRef.current) return
      isBibleOverlayOpenRef.current = false
      setIsBibleOverlayOpen(false)
      setIsFullScreenBible(wasFullScreenBeforeOverlayRef.current)
    },
    [setIsBibleOverlayOpen, setIsFullScreenBible]
  )

  // Gate verses delivery: don't send real data until the DOM component
  // has mounted and its bridge message listener is active. This prevents
  // the race condition where prop updates are lost during WebView init.
  const [isDOMMounted, setIsDOMMounted] = useState(false)
  const versesToSend = isDOMMounted ? stableVerses : []

  // Trim settings to only include active theme colors (reduces bridge serialization by ~3.8KB)
  const trimmedSettings = {
    ...settings,
    colors: { [settings.theme]: settings.colors[settings.theme] },
  } as typeof settings

  // Translations for the DOM component (which can't access i18n directly)
  const translations: BibleDOMTranslations = {
    parallelVersionNotFound: t('bible.error.parallelVersionNotFound'),
    parallelChapterNotFound: t('bible.error.parallelChapterNotFound'),
    parallelLoadError: t('bible.error.parallelLoadError'),
    exitFocus: t('tab.exitFocus'),
    resourceFailureDetails: {
      'Référence introuvable': t('Référence introuvable'),
      'app.youAreOffline': t('app.youAreOffline'),
      'resource.status.offlineNotInstalled': t('resource.status.offlineNotInstalled'),
      'resource.status.onlineUnsupported': t('resource.status.onlineUnsupported'),
      'bible.error.databaseCorrupted': t('bible.error.databaseCorrupted'),
      'resource.action.temporarilyUnavailable': t('resource.action.temporarilyUnavailable'),
      'bible.error.integrityFailure': t('bible.error.integrityFailure'),
      'bible.error.unknown': t('bible.error.unknown'),
    },
    goToDownloads: t('bible.error.goToDownloads'),
    downloadVersion: t('bible.error.downloadVersion'),
    repairOfflineCopy: t('resource.action.repairOfflineCopy'),
    connectionRequired: t('resource.action.connectionRequired'),
    downloading: t('bible.error.downloading'),
    inserting: t('bible.error.inserting'),
    resetDatabase: t('bible.error.resetDatabase'),
    retry: t('bible.error.retry'),
    openCanonicalBibleNote: t('Afficher la note'),
    pericopeIndex: t('Péricopes'),
    passageMediaTitle: t('bible.passageMedia.title'),
    passageMediaClose: t('Fermer'),
    passageMediaBookName: t(book.Nom),
    passageMediaChapter: chapter,
    passageMediaSections: {
      introduction: t('bible.passageMedia.sections.introduction'),
      passages: t('bible.passageMedia.sections.passages'),
      chapterResources: t('bible.passageMedia.sections.chapterResources'),
    },
  }
  const chapterEntityTranslations = {
    title: t('bible.chapterEntities.title'),
    groups: {
      person: t('bible.chapterEntities.people'),
      place: t('bible.chapterEntities.places'),
      group: t('bible.chapterEntities.groups'),
      supernatural: t('bible.chapterEntities.supernatural'),
      other: t('bible.chapterEntities.others'),
    },
    openEntity: t('bible.chapterEntities.open'),
    empty: t('bible.chapterEntities.empty'),
    downloadTitle: t('strongLexicon.biblicalEntities'),
    downloadDescription: t('strongLexicon.biblicalEntitiesDescription'),
    downloading: t('bible.error.downloading'),
    downloadFailed: t('bible.chapterEntities.downloadFailed'),
    dismiss: t('bible.chapterEntities.dismissAccessibility'),
  }
  const dispatch: Dispatch = async action => {
    appLogger.debug('webview', 'bible_dom.dispatch', { actionType: action.type })
    if (__DEV__) console.log('[Bible] DISPATCH:', action.type)
    if (!personalBibleDataEnabled && isPersonalBibleDataAction(action.type)) return

    switch (action.type) {
      case SET_BIBLE_OVERLAY_OPEN: {
        if (
          typeof action.payload !== 'boolean' ||
          action.payload === isBibleOverlayOpenRef.current
        ) {
          break
        }

        if (action.payload) {
          wasFullScreenBeforeOverlayRef.current = getDefaultStore().get(isFullScreenBibleAtom)
        }

        isBibleOverlayOpenRef.current = action.payload
        setIsBibleOverlayOpen(action.payload)
        setIsFullScreenBible(action.payload ? true : wasFullScreenBeforeOverlayRef.current)
        break
      }
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        if (!action.params) break
        const { Livre, Chapitre, Verset } = action.params.verse
        if (__DEV__) console.log(`[Bible] ${Livre}-${Chapitre}-${Verset}`)
        onOpenResourceForVerse?.('strong', `${Livre}-${Chapitre}-${Verset}`)

        break
      }
      case NAVIGATE_TO_BIBLICAL_ENTITY: {
        const entityKey = getStringPayload(action.payload)
        if (!entityKey) break
        pushRouteOnce(
          createStrongDetailRoute(
            'entity',
            {
              book: book.Numero,
              bibleVersion: version,
              bibleChapter: chapter,
            },
            { entityKey }
          )
        )
        break
      }
      case NAVIGATE_TO_STRONG: {
        const strongCode = getStringPayload(action.payload)
        if (!strongCode) break
        const lexicalLanguage = strongCode.trim().toUpperCase().startsWith('G') ? 'greek' : 'hebrew'
        const identity = createStrongIdentity(strongCode, lexicalLanguage)
        pushRouteOnce(
          createStrongDetailRoute('index', {
            book: lexicalLanguage === 'greek' ? 40 : 1,
            reference: identity.code,
            identityKind: identity.kind,
            identityCode: identity.code,
            bibleVersion: version,
            bibleChapter: chapter,
          })
        )
        break
      }
      case DOWNLOAD_CHAPTER_ENTITIES: {
        if (!chapterEntityModuleStatus || chapterEntityModuleStatus === 'available') break
        downloadManager.enqueue(
          createStrongLexiconModuleDownloadPlan(
            'entities',
            chapterEntityModuleStatus !== 'core-missing'
          )
        )
        break
      }
      case DISMISS_CONTEXTUAL_INFORMATION: {
        Alert.alert(
          t('bible.chapterEntities.dismissTitle'),
          t('bible.chapterEntities.dismissMessage'),
          [
            { text: t('Annuler'), style: 'cancel' },
            {
              text: t('bible.chapterEntities.dismissConfirm'),
              onPress: onDisableContextualInformation,
            },
          ]
        )
        break
      }
      case NAVIGATE_TO_VERSE_LINKS: {
        const verseKey = getStringPayload(action.payload)
        if (!verseKey) break
        router.push({
          pathname: '/bible-verse-links',
          params: {
            verse: verseKey,
            withBack: 'true',
          },
        })
        break
      }
      case NAVIGATE_TO_VERSE_STUDY_RELATIONS: {
        const target = getStudyRelationsModalTarget(action.payload)
        if (target) onOpenStudyRelationsModal?.(target)
        break
      }
      case NAVIGATE_TO_PERICOPE: {
        router.push({
          pathname: '/pericope',
          params: { book: String(book.Numero), version },
        })
        break
      }
      case NAVIGATE_TO_VERSION: {
        if (!isRecord(action.payload)) break
        const { version, index } = action.payload
        if (typeof version !== 'string' || typeof index !== 'number') break

        // index = 0 is Default one
        openVersionSelector({
          actions: {
            setSelectedVersion: (version: VersionCode) =>
              getDefaultStore().set(
                bibleAtom,
                produce(draft => {
                  draft.data = selectBibleTabVersion(draft.data, version)
                })
              ),
            setParallelVersion: (version: VersionCode, index: number) =>
              getDefaultStore().set(
                bibleAtom,
                produce(draft => {
                  draft.data.parallelVersions[index] = version
                })
              ),
          },
          data: getDefaultStore().get(bibleAtom).data,
          parallelVersionIndex: index === 0 ? undefined : index - 1,
        })
        break
      }
      case REMOVE_PARALLEL_VERSION: {
        const index = getNumberPayload(action.payload)
        if (typeof index === 'number') removeParallelVersion?.(index - 1)
        break
      }
      case ADD_PARALLEL_VERSION: {
        addParallelVersion?.()
        break
      }
      case OPEN_STRONG_SELECTION: {
        const selection = getStrongSelectionPayload(action.payload)
        if (selection) setSelectedCode(selection)
        break
      }
      case TOGGLE_SELECTED_VERSE: {
        if (Platform.OS === 'ios') {
          Haptics.selectionAsync()
        }
        const verseId = getStringPayload(action.payload)
        if (!verseId) break

        if (selectedVerses[verseId]) {
          removeSelectedVerse(verseId)
        } else {
          addSelectedVerse(verseId)
        }

        break
      }

      case NAVIGATE_TO_BIBLE_NOTE: {
        const payload = getNoteNavigationPayload(action.payload)
        if (payload.noteId) openNote?.(payload.noteId, payload.verseIds)
        break
      }
      case NAVIGATE_TO_BIBLE_LINK: {
        const linkId = getStringPayload(action.payload)
        if (linkId) openLink?.(linkId)
        break
      }
      case NAVIGATE_TO_RELATION_ENDPOINT: {
        if (isRecord(action.payload)) {
          const strongSelection = getStrongRelationSelectionPayload(action.payload, version)
          if (strongSelection) {
            setSelectedCode(strongSelection)
          } else {
            openRelationEndpoint(action.payload as RelationEndpoint)
          }
        }
        break
      }
      case SHOW_TOAST: {
        const { message, type } = getToastPayload(action.payload)
        if (!message) break
        if (type === 'warning') {
          toast.warning(t(message))
        } else if (type === 'error') {
          toast.error(t(message))
        } else {
          toast.info(t(message))
        }
        break
      }
      case NAVIGATE_TO_BIBLE_VIEW: {
        const targetBook = Object.keys(books).find(
          key => books[key]?.[0]?.toUpperCase() === action.bookCode
        )

        if (!targetBook) {
          toast.error("Erreur lors de l'ouverture du verset")
          appLogger.captureError(
            'webview',
            'bible_navigation.unknown_book_code',
            new Error('BIBLE_NAVIGATION_BOOK_CODE_UNKNOWN'),
            {
              actionType: action.type,
              bookCode: action.bookCode,
            }
          )
          return
        }

        pushRouteOnce({
          pathname: '/bible-view',
          params: {
            contextDisplayMode: 'focused',
            book: targetBook,
            chapter: String(action.chapter),
            verse: String(action.verse),
          },
        })

        break
      }
      case SWIPE_LEFT: {
        // Disable chapter navigation in focused context or annotation mode
        if (isContextFocused || annotationMode) break

        goToNextChapter?.()
        break
      }
      case SWIPE_RIGHT: {
        // Disable chapter navigation in focused context or annotation mode
        if (isContextFocused || annotationMode) break

        goToPrevChapter?.()
        break
      }
      case SWIPE_DOWN: {
        if (isFormSheet) break
        setIsFullScreenBible(true)
        break
      }
      case SWIPE_UP: {
        if (isFormSheet) break
        setIsFullScreenBible(false)
        break
      }
      case OPEN_HIGHLIGHT_TAGS: {
        const verseIds = getVerseIdsPayload(action.payload)
        const obj = {
          mode: 'select' as const,
          entity: 'highlights' as const,
          ids: Object.fromEntries(verseIds.map(v => [v, true])) as Record<string, true>,
        }
        setUnifiedTagsModal?.(obj)
        break
      }

      case OPEN_BOOKMARK_MODAL: {
        const bookmark = getBookmarkPayload(action.payload)
        if (bookmark) onOpenBookmarkModal?.(bookmark)
        break
      }

      case OPEN_CANONICAL_BIBLE_NOTE: {
        const note = getCanonicalBibleNotePayload(action.payload)
        if (note) onOpenCanonicalBibleNote?.(note)
        break
      }

      case OPEN_CANONICAL_BIBLE_REFERENCE: {
        const osis = getStringPayload(action.payload)
        if (osis) onOpenCanonicalBibleReference?.(osis)
        break
      }

      case NAVIGATE_TO_TAG: {
        if (!isRecord(action.payload) || typeof action.payload.tagId !== 'string') break
        const { tagId } = action.payload
        pushRouteOnce({ pathname: '/tag', params: { tagId } })
        break
      }

      case EXPAND_CONTEXT: {
        expandContext?.()
        break
      }

      case COLLAPSE_CONTEXT: {
        collapseContext?.()
        break
      }

      case CLEAR_FOCUS_VERSES: {
        clearFocusVerses?.()
        break
      }

      case ENTER_ANNOTATION_MODE: {
        onEnterAnnotationMode?.()
        break
      }

      case SELECTION_CHANGED: {
        if (!isRecord(action.payload)) break
        const { hasSelection, selection } = action.payload
        if (typeof hasSelection === 'boolean') {
          onSelectionChanged?.(hasSelection, (selection as SelectionRange | null) || null)
        }
        break
      }

      case CREATE_ANNOTATION: {
        if (isRecord(action.payload)) {
          onCreateAnnotation?.(
            action.payload as Parameters<NonNullable<WebViewProps['onCreateAnnotation']>>[0]
          )
        }
        break
      }

      case ERASE_SELECTION: {
        if (isRecord(action.payload)) {
          onEraseSelection?.(
            action.payload as Parameters<NonNullable<WebViewProps['onEraseSelection']>>[0]
          )
        }
        break
      }

      case ANNOTATION_SELECTED: {
        if (!isRecord(action.payload)) break
        const { annotationId } = action.payload
        if (typeof annotationId === 'string' || annotationId === null) {
          onAnnotationSelected?.(annotationId)
        }
        break
      }

      case OPEN_CROSS_VERSION_MODAL: {
        if (!isRecord(action.payload)) break
        const { verseKey, versions } = action.payload
        if (typeof verseKey === 'string' && Array.isArray(versions)) {
          onOpenCrossVersionModal?.(verseKey, versions as CrossVersionAnnotation[])
        }
        break
      }

      case OPEN_VERSE_TAGS_MODAL: {
        const verseKey = getStringPayload(action.payload)
        if (verseKey) onOpenVerseTagsModal?.(verseKey)
        break
      }

      case DOWNLOAD_BIBLE_VERSION: {
        const requestedVersion = getStringPayload(action.payload)
        if (!requestedVersion) break
        try {
          downloadManager.enqueue([createBibleDownloadItem(requestedVersion)])
        } catch (e) {
          console.error('[BibleDOMWrapper] Failed to enqueue download:', e)
          toast.error(t('bible.error.unknown'))
        }
        break
      }

      case OPEN_DOWNLOADS: {
        router.push('/downloads')
        break
      }

      case RESET_BIBLE_DATABASE: {
        setIsResettingDatabase(true)
        try {
          await resetBiblesDb()
          toast.success(t('bible.error.databaseRecovered'))
        } catch {
          toast.error(t('bible.error.databaseOpenFailed'))
        } finally {
          setIsResettingDatabase(false)
        }
        break
      }

      case RETRY_BIBLE_RESOURCE: {
        await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.bibleContent() })
        break
      }

      case 'DOM_COMPONENT_MOUNTED': {
        appLogger.info('webview', 'bible_dom.mounted', {
          version,
          book: book.Numero,
          chapter,
        })
        setIsDOMMounted(true)
        break
      }

      default: {
        break
      }
    }
  }

  // Pre-compute verse metadata on native side (avoids DOM JS thread work)
  const computedComments = transformComments(comments, versesToSend.length)
  const taggedVerses = sortVersesToTags(highlightedVerses)
  const { versesWithAnnotationNotes, annotationNotesCountByVerse } = getAnnotationNotesInfo(
    versesToSend,
    wordAnnotations,
    version
  )
  const relationsDisplay =
    settings.relationsDisplay ||
    (settings.notesDisplay === 'block' || settings.linksDisplay === 'block' ? 'block' : 'inline')
  const relationMetadata = getVerseRelationsMetadata(
    versesToSend,
    studyRelations,
    relationsDisplay,
    {
      notes: allNotes,
      links: allLinks,
    }
  )
  const TOP_INSET = isFormSheet ? 0 : insets.top
  const headerHeight = isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT
  const nativeLayerZIndex = -1

  return (
    <Box
      style={{
        backgroundColor: theme.colors.reverse,
        zIndex: nativeLayerZIndex,
        flex: 1,
      }}
    >
      <BibleDOMComponent
        dom={{
          useExpoDOMWebView: false,
          webviewDebuggingEnabled: __DEV__,
          allowsInlineMediaPlayback: true,
          allowsFullscreenVideo: true,
          mediaPlaybackRequiresUserAction: false,
          style: {
            flex: 1,
            backgroundColor: theme.colors.reverse,
          },
          containerStyle: {
            flex: 1,
            backgroundColor: theme.colors.reverse,
            ...(Platform.OS === 'android' && {
              marginTop: TOP_INSET,
            }),
          },
          injectedJavaScriptBeforeContentLoaded: DOM_WEBVIEW_INITIAL_SCRIPT,
        }}
        verses={versesToSend}
        parallelVerses={parallelVerses}
        parallelColumnWidth={parallelColumnWidth}
        parallelDisplayMode={parallelDisplayMode}
        focusVerses={focusVerses}
        selectedVerses={selectedVerses}
        highlightedVerses={highlightedVerses}
        bookmarkedVerses={bookmarkedVerses}
        wordAnnotations={wordAnnotations}
        settings={trimmedSettings}
        verseToScroll={verseToScroll}
        contextDisplayMode={contextDisplayMode}
        version={version}
        interlinearMode={interlinearMode}
        pericopeChapter={pericopeChapter}
        passageMedia={passageMedia}
        book={book}
        chapter={chapter}
        isSelectionMode={isSelectionMode}
        selectedCode={selectedCode}
        comments={computedComments}
        dispatch={dispatch}
        translations={translations}
        chapterEntityTranslations={chapterEntityTranslations}
        annotationMode={annotationMode}
        clearSelectionTrigger={clearSelectionTrigger}
        applyAnnotationTrigger={applyAnnotationTrigger}
        eraseSelectionTrigger={eraseSelectionTrigger}
        clearAnnotationSelectionTrigger={clearAnnotationSelectionTrigger}
        selectedAnnotationId={selectedAnnotationId}
        safeAreaTop={Platform.OS === 'ios' ? TOP_INSET : 0}
        wordAnnotationsInOtherVersions={wordAnnotationsInOtherVersions}
        taggedVersesInChapter={taggedVersesInChapter}
        versesWithNonHighlightTags={versesWithNonHighlightTags}
        redWords={redWords}
        chapterEntities={chapterEntities}
        chapterEntitiesLoaded={chapterEntitiesLoaded}
        chapterEntityModuleStatus={chapterEntityModuleStatus}
        chapterEntityDownloadState={chapterEntityDownloadState}
        error={error}
        errorDownloadState={errorDownloadState}
        isResettingDatabase={isResettingDatabase}
        taggedVerses={taggedVerses}
        versesWithAnnotationNotes={versesWithAnnotationNotes}
        annotationNotesCountByVerse={annotationNotesCountByVerse}
        relationItemsCount={relationMetadata.counts}
        relationItemsText={relationMetadata.items}
        isFormSheet={isFormSheet}
        isConnected={isConnected}
      />
      {Platform.OS === 'android' && Number(Platform.Version) < 30 && (
        <AndroidWebViewWarningModal top={headerHeight + TOP_INSET} />
      )}
    </Box>
  )
}
