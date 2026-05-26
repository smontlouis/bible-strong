import { useTheme } from '@emotion/react'
import * as Sentry from '@sentry/react-native'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isFullScreenBibleAtom } from 'src/state/app'
import { BibleTab, ParallelColumnWidth, ParallelDisplayMode, VersionCode } from 'src/state/tabs'
import { isINTCompleteAtom } from '../footer/atom'
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
  StudyNavigateBibleType,
  Tag,
  Verse,
  VerseIds,
} from '~common/types'
import Box from '~common/ui/Box'
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
} from '~features/app-switcher/utils/constants'
import { HelpTip } from '~features/tips/HelpTip'
import { appLogger } from '~helpers/agentObservability'
import { BibleError } from '~helpers/bibleErrors'
import { toast } from '~helpers/toast'
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
import { useBookAndVersionSelector } from '../BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import type { AnnotationType, SelectionRange, WordPosition } from '../hooks/useAnnotationMode'
import { BibleDOMTranslations } from './TranslationsContext'
import {
  ADD_PARALLEL_VERSION,
  ANNOTATION_SELECTED,
  CLEAR_FOCUS_VERSES,
  CREATE_ANNOTATION,
  ENTER_ANNOTATION_MODE,
  ENTER_READONLY_MODE,
  ERASE_SELECTION,
  EXIT_READONLY_MODE,
  NAVIGATE_TO_BIBLE_LINK,
  NAVIGATE_TO_BIBLE_NOTE,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_BIBLE_VIEW,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_RELATION_ENDPOINT,
  NAVIGATE_TO_STRONG,
  NAVIGATE_TO_TAG,
  NAVIGATE_TO_VERSE_LINKS,
  NAVIGATE_TO_VERSE_STUDY_RELATIONS,
  NAVIGATE_TO_VERSION,
  OPEN_BOOKMARK_MODAL,
  OPEN_CROSS_VERSION_MODAL,
  OPEN_HIGHLIGHT_TAGS,
  OPEN_VERSE_NOTES_MODAL,
  OPEN_VERSE_TAGS_MODAL,
  REMOVE_PARALLEL_VERSION,
  SELECTION_CHANGED,
  SHOW_TOAST,
  SWIPE_DOWN,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  SWIPE_UP,
  TOGGLE_INT_COMPLETE,
  TOGGLE_SELECTED_VERSE,
} from './dispatch'

export type ParallelVerse = {
  id: VersionCode
  verses: Verse[]
  error?: BibleError
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

export type StudyRelationsModalTarget =
  | string
  | {
      verseKey?: string
      verseIds?: string[]
      relationId?: string
    }

type DispatchAction = {
  type: string
  payload?: unknown
  params?: {
    verse: Verse
    isSelectionMode?: StudyNavigateBibleType
  }
  bookCode?: string
  chapter?: string | number
  verse?: string | number
}

export type Dispatch = (props: DispatchAction) => Promise<void>

const books = booksJson as Record<string, string[]>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getStringPayload = (payload: unknown): string | undefined =>
  typeof payload === 'string' ? payload : undefined

const getNumberPayload = (payload: unknown): number | undefined =>
  typeof payload === 'number' ? payload : undefined

const getToastPayload = (payload: unknown): { message?: string; type?: string } => {
  if (!isRecord(payload)) return {}
  return {
    message: getStringPayload(payload.message),
    type: getStringPayload(payload.type),
  }
}

const getVerseIdsPayload = (payload: unknown): string[] => {
  if (!isRecord(payload) || !Array.isArray(payload.verseIds)) return []
  return payload.verseIds.filter((verseId): verseId is string => typeof verseId === 'string')
}

const getStudyRelationsModalTarget = (payload: unknown): StudyRelationsModalTarget | undefined => {
  if (typeof payload === 'string') return payload
  if (!isRecord(payload)) return undefined

  const verseKey = getStringPayload(payload.verseKey)
  const relationId = getStringPayload(payload.relationId)
  const verseIds = getVerseIdsPayload(payload)

  if (!verseKey && !verseIds.length) return undefined

  return {
    verseKey,
    relationId,
    verseIds,
  }
}

const getNoteNavigationPayload = (payload: unknown): { noteId?: string; verseIds: string[] } => {
  if (typeof payload === 'string') {
    return { noteId: payload, verseIds: [] }
  }
  if (!isRecord(payload)) {
    return { verseIds: [] }
  }
  return {
    noteId: getStringPayload(payload.noteId),
    verseIds: getVerseIdsPayload(payload),
  }
}

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

export type WebViewProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  isBibleViewReloadingAtom: PrimitiveAtom<boolean>
  book: Book
  chapter: number
  isLoading: boolean
  addSelectedVerse: (id: string) => void
  removeSelectedVerse: (id: string) => void
  setSelectedVerse: (selectedVerse: number) => void
  version: VersionCode
  isReadOnly: boolean
  isSelectionMode: StudyNavigateBibleType | undefined
  verses: Verse[]
  parallelVerses: ParallelVerse[]
  parallelColumnWidth?: ParallelColumnWidth
  parallelDisplayMode?: ParallelDisplayMode

  focusVerses: (string | number)[] | undefined
  secondaryVerses: Verse[] | null
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
  openNote?: (noteId: string, verseIds?: string[]) => void
  openLink?: (linkId: string) => void
  setSelectedCode: (selectedCode: SelectedCode) => void
  selectedCode: SelectedCode | null
  comments: { [key: string]: string } | null
  removeParallelVersion?: (index: number) => void
  addParallelVersion?: () => void
  goToPrevChapter?: () => void
  goToNextChapter?: () => void
  setUnifiedTagsModal?: (payload: HighlightTagsModalPayload) => void
  onChangeResourceTypeSelectVerse?: (resourceType: BibleResource, verseKey: string) => void
  onMountTimeout?: () => void
  onOpenBookmarkModal?: (bookmark: Bookmark) => void
  exitReadOnlyMode?: () => void
  enterReadOnlyMode?: () => void
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
  // Verse notes modal
  onOpenVerseNotesModal?: (verseKey: string) => void
  onOpenStudyRelationsModal?: (target: StudyRelationsModalTarget) => void
  isFormSheet?: boolean
  // Enter annotation mode from double-tap
  onEnterAnnotationMode?: () => void
  // Red words data
  redWords?: Record<string, { start: number; end: number }[]> | null
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
  secondaryVerses,
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
  isReadOnly,
  version,
  pericopeChapter,
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
  onChangeResourceTypeSelectVerse,
  onOpenVerseNotesModal,
  onOpenStudyRelationsModal,
  openNote,
  openLink,
  removeParallelVersion,
  addParallelVersion,
  setSelectedCode,
  removeSelectedVerse,
  addSelectedVerse,
  exitReadOnlyMode,
  enterReadOnlyMode,
  clearFocusVerses,
  onSelectionChanged,
  onCreateAnnotation,
  onEraseSelection,
  onAnnotationSelected,
  onOpenBookmarkModal,
  onOpenCrossVersionModal,
  onOpenVerseTagsModal,
  setUnifiedTagsModal,
  bibleAtom,
  goToPrevChapter,
  goToNextChapter,
  onEnterAnnotationMode,
  isFormSheet,
  redWords,
  isLoading,
  onMountTimeout,
}: WebViewProps) => {
  const { openVersionSelector } = useBookAndVersionSelector()
  const openRelationEndpoint = useOpenRelationEndpoint()
  const [isINTComplete, setIsINTComplete] = useAtom(isINTCompleteAtom)
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const router = useRouter()

  const stableVerses = useStabilizedVerses(verses, isLoading)

  // Gate verses delivery: don't send real data until the DOM component
  // has mounted and its bridge message listener is active. This prevents
  // the race condition where prop updates are lost during WebView init.
  const [isDOMMounted, setIsDOMMounted] = useState(false)
  const versesToSend = isDOMMounted ? stableVerses : []

  // Watchdog: if the DOM component never signals DOM_COMPONENT_MOUNTED,
  // the WebView is stuck (white screen). Fire onMountTimeout so the parent
  // can force a remount.
  useEffect(() => {
    if (isDOMMounted) return
    const MOUNT_TIMEOUT_MS = 5000
    const timer = setTimeout(() => {
      appLogger.warn('webview', 'bible_dom.mount.timeout', {
        timeoutMs: MOUNT_TIMEOUT_MS,
        version,
        book: book.Numero,
        chapter,
      })
      Sentry.captureMessage('BibleDOM mount timeout (no DOM_COMPONENT_MOUNTED)', {
        level: 'warning',
        tags: { component: 'BibleDOMWrapper' },
      })
      onMountTimeout?.()
    }, MOUNT_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isDOMMounted, onMountTimeout])

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
    readWholeChapter: t('tab.readWholeChapter'),
    closeContext: t('tab.closeContext'),
    exitFocus: t('tab.exitFocus'),
    interlinearDetailed: t('bible.interlinear.detailed'),
    interlinearCompact: t('bible.interlinear.compact'),
  }
  const dispatch: Dispatch = async action => {
    appLogger.debug('webview', 'bible_dom.dispatch', { actionType: action.type })
    if (__DEV__) console.log('[Bible] DISPATCH:', action.type)
    switch (action.type) {
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        if (!action.params) break
        const { Livre, Chapitre, Verset } = action.params.verse
        if (__DEV__) console.log(`[Bible] ${Livre}-${Chapitre}-${Verset}`)
        onChangeResourceTypeSelectVerse?.('strong', `${Livre}-${Chapitre}-${Verset}`)

        break
      }
      case OPEN_VERSE_NOTES_MODAL: {
        const verseKey = getStringPayload(action.payload)
        if (verseKey) onOpenVerseNotesModal?.(verseKey)
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
          params: { book: String(book.Numero) },
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
                  draft.data.selectedVersion = version
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
      case NAVIGATE_TO_STRONG: {
        if (isRecord(action.payload)) {
          setSelectedCode(action.payload as SelectedCode) // { reference, book }
        }
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
          openRelationEndpoint(action.payload as RelationEndpoint)
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
          Sentry.captureMessage(JSON.stringify(action))
          return
        }

        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: targetBook,
            chapter: String(action.chapter),
            verse: String(action.verse),
          },
        })

        break
      }
      case SWIPE_LEFT: {
        // Disable chapter navigation in readonly or annotation mode
        if (isReadOnly || annotationMode) break

        const hasNextChapter = !(book.Numero === 66 && chapter === 22)

        if (hasNextChapter) {
          goToNextChapter?.()
        }
        break
      }
      case SWIPE_RIGHT: {
        // Disable chapter navigation in readonly or annotation mode
        if (isReadOnly || annotationMode) break

        const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)

        if (hasPreviousChapter) {
          goToPrevChapter?.()
        }
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
        if (isRecord(action.payload)) onOpenBookmarkModal?.(action.payload as unknown as Bookmark)
        break
      }

      case NAVIGATE_TO_TAG: {
        if (!isRecord(action.payload) || typeof action.payload.tagId !== 'string') break
        const { tagId } = action.payload
        router.push({ pathname: '/tag', params: { tagId } })
        break
      }

      case EXIT_READONLY_MODE: {
        exitReadOnlyMode?.()
        break
      }

      case ENTER_READONLY_MODE: {
        enterReadOnlyMode?.()
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

      case TOGGLE_INT_COMPLETE: {
        setIsINTComplete(prev => !prev)
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

  return (
    <Box
      style={{
        backgroundColor: theme.colors.reverse,
        zIndex: -1,
        flex: 1,
      }}
    >
      <BibleDOMComponent
        dom={{
          webviewDebuggingEnabled: __DEV__,
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
          injectedJavaScriptBeforeContentLoaded: `document.documentElement.style.backgroundColor='${theme.colors.reverse}';document.body.style.backgroundColor='${theme.colors.reverse}';document.body.style.margin='0';true;`,
        }}
        verses={versesToSend}
        parallelVerses={parallelVerses}
        parallelColumnWidth={parallelColumnWidth}
        parallelDisplayMode={parallelDisplayMode}
        focusVerses={focusVerses}
        secondaryVerses={secondaryVerses}
        selectedVerses={selectedVerses}
        highlightedVerses={highlightedVerses}
        bookmarkedVerses={bookmarkedVerses}
        wordAnnotations={wordAnnotations}
        settings={trimmedSettings}
        verseToScroll={verseToScroll}
        isReadOnly={isReadOnly}
        version={version}
        pericopeChapter={pericopeChapter}
        book={book}
        chapter={chapter}
        isSelectionMode={isSelectionMode}
        selectedCode={selectedCode}
        comments={computedComments}
        dispatch={dispatch}
        translations={translations}
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
        isINTComplete={isINTComplete}
        taggedVerses={taggedVerses}
        versesWithAnnotationNotes={versesWithAnnotationNotes}
        annotationNotesCountByVerse={annotationNotesCountByVerse}
        relationItemsCount={relationMetadata.counts}
        relationItemsText={relationMetadata.items}
        isFormSheet={isFormSheet}
      />
      {Platform.OS === 'android' && Platform.Version < 30 && (
        <HelpTip
          id="bible-dom-wrapper-android"
          description={t('tips.bible-dom-wrapper-android')}
          type="warning"
          position="absolute"
          left={0}
          right={0}
          top={headerHeight + TOP_INSET}
        />
      )}
    </Box>
  )
}
