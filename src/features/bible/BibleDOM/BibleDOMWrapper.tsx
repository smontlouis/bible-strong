import { useTheme } from '@emotion/react'
import * as Sentry from '@sentry/react-native'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import produce from 'immer'
import { useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isFullScreenBibleAtom, tagDetailModalAtom } from 'src/state/app'
import { BibleTab, ParallelColumnWidth, ParallelDisplayMode, VersionCode } from 'src/state/tabs'
import BibleDOMComponent from './BibleDOMComponent'
// @ts-ignore
import books from '~assets/bible_versions/books'
import { Book } from '~assets/bible_versions/books-desc'
import type { Bookmark } from '~common/types'
import { Pericope, SelectedCode, StudyNavigateBibleType, Tag, Verse, VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import { HelpTip } from '~features/tips/HelpTip'
import { BibleError } from '~helpers/bibleErrors'
import { toast } from '~helpers/toast'
import { RootState } from '~redux/modules/reducer'
import { HighlightsObj, LinksObj, NotesObj, WordAnnotationsObj } from '~redux/modules/user'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
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
  NAVIGATE_TO_STRONG,
  NAVIGATE_TO_TAG,
  NAVIGATE_TO_VERSE_LINKS,
  NAVIGATE_TO_VERSION,
  OPEN_BOOKMARK_MODAL,
  OPEN_CROSS_VERSION_MODAL,
  OPEN_HIGHLIGHT_TAGS,
  OPEN_VERSE_NOTES_MODAL,
  OPEN_VERSE_TAGS_MODAL,
  REMOVE_PARALLEL_VERSION,
  SELECTION_CHANGED,
  SWIPE_DOWN,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  SWIPE_UP,
  TOGGLE_SELECTED_VERSE,
} from './dispatch'

export type ParallelVerse = {
  id: VersionCode
  verses: Verse[]
  error?: BibleError
}

export type TaggedVerse = {
  lastVerse: any
  tags: Tag[]
  date: number
  color: string
  verseIds: any[]
}

export type RootStyles = {
  settings: RootState['user']['bible']['settings']
}

export type PericopeChapter = Pericope[string][string]

export type Dispatch = (props: { type: string; [key: string]: any }) => Promise<void>

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
  bookmarkedVerses: Record<number, Bookmark>
  linkedVerses: LinksObj
  wordAnnotations: WordAnnotationsObj
  settings: RootState['user']['bible']['settings']
  verseToScroll: number | undefined
  pericopeChapter: PericopeChapter
  openNoteModal?: any
  openLinkModal?: any
  setSelectedCode: (selectedCode: SelectedCode) => void
  selectedCode: SelectedCode | null
  comments: { [key: string]: string } | null
  removeParallelVersion?: any
  addParallelVersion?: any
  goToPrevChapter?: any
  goToNextChapter?: any
  setUnifiedTagsModal?: any
  onChangeResourceTypeSelectVerse?: any
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
  bookmarkedVerses,
  linkedVerses,
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
  openNoteModal,
  openLinkModal,
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
  redWords,
}: WebViewProps) => {
  const { openVersionSelector } = useBookAndVersionSelector()
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)
  const setTagDetailModal = useSetAtom(tagDetailModalAtom)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const router = useRouter()

  // Translations for the DOM component (which can't access i18n directly)
  const translations: BibleDOMTranslations = {
    parallelVersionNotFound: t('bible.error.parallelVersionNotFound'),
    parallelChapterNotFound: t('bible.error.parallelChapterNotFound'),
    parallelLoadError: t('bible.error.parallelLoadError'),
    readWholeChapter: t('tab.readWholeChapter'),
    closeContext: t('tab.closeContext'),
    exitFocus: t('tab.exitFocus'),
  }
  const dispatch: Dispatch = async action => {
    if (__DEV__) console.log('[Bible] DISPATCH:', action.type)
    switch (action.type) {
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        const { Livre, Chapitre, Verset } = action.params.verse
        if (__DEV__) console.log(`[Bible] ${Livre}-${Chapitre}-${Verset}`)
        onChangeResourceTypeSelectVerse?.('strong', `${Livre}-${Chapitre}-${Verset}`)

        break
      }
      case OPEN_VERSE_NOTES_MODAL: {
        onOpenVerseNotesModal?.(action.payload)
        break
      }
      case NAVIGATE_TO_VERSE_LINKS: {
        router.push({
          pathname: '/bible-verse-links',
          params: {
            verse: action.payload,
            withBack: 'true',
          },
        })
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
        const { version, index } = action.payload

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
        removeParallelVersion(action.payload - 1)
        break
      }
      case ADD_PARALLEL_VERSION: {
        addParallelVersion()
        break
      }
      case NAVIGATE_TO_STRONG: {
        setSelectedCode(action.payload) // { reference, book }
        break
      }
      case TOGGLE_SELECTED_VERSE: {
        if (Platform.OS === 'ios') {
          Haptics.selectionAsync()
        }
        const verseId = action.payload

        if (selectedVerses[verseId]) {
          removeSelectedVerse(verseId)
        } else {
          addSelectedVerse(verseId)
        }

        break
      }

      case NAVIGATE_TO_BIBLE_NOTE: {
        openNoteModal(action.payload)
        break
      }
      case NAVIGATE_TO_BIBLE_LINK: {
        openLinkModal?.(action.payload)
        break
      }
      case NAVIGATE_TO_BIBLE_VIEW: {
        // @ts-ignore
        const book = Object.keys(books).find(key => books[key][0].toUpperCase() === action.bookCode)

        if (!book) {
          toast.error("Erreur lors de l'ouverture du verset")
          Sentry.captureMessage(JSON.stringify(action))
          return
        }

        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: book,
            chapter: action.chapter,
            verse: action.verse,
          },
        })

        break
      }
      case SWIPE_LEFT: {
        // Disable chapter navigation in readonly or annotation mode
        if (isReadOnly || annotationMode) break

        const hasNextChapter = !(book.Numero === 66 && chapter === 22)

        if (hasNextChapter) {
          goToNextChapter()
        }
        break
      }
      case SWIPE_RIGHT: {
        // Disable chapter navigation in readonly or annotation mode
        if (isReadOnly || annotationMode) break

        const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)

        if (hasPreviousChapter) {
          goToPrevChapter()
        }
        break
      }
      case SWIPE_DOWN: {
        setIsFullScreenBible(true)
        break
      }
      case SWIPE_UP: {
        setIsFullScreenBible(false)
        break
      }
      case OPEN_HIGHLIGHT_TAGS: {
        const { verseIds } = action.payload
        const obj = {
          mode: 'select' as const,
          entity: 'highlights',
          ids: Object.fromEntries(verseIds.map((v: any) => [v, true])),
        }
        setUnifiedTagsModal(obj)
        break
      }

      case OPEN_BOOKMARK_MODAL: {
        onOpenBookmarkModal?.(action.payload)
        break
      }

      case NAVIGATE_TO_TAG: {
        const { tagId } = action.payload
        setTagDetailModal({ tagId })
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
        const { hasSelection, selection } = action.payload
        onSelectionChanged?.(hasSelection, selection)
        break
      }

      case CREATE_ANNOTATION: {
        onCreateAnnotation?.(action.payload)
        break
      }

      case ERASE_SELECTION: {
        onEraseSelection?.(action.payload)
        break
      }

      case ANNOTATION_SELECTED: {
        const { annotationId } = action.payload
        onAnnotationSelected?.(annotationId)
        break
      }

      case OPEN_CROSS_VERSION_MODAL: {
        const { verseKey, versions } = action.payload
        onOpenCrossVersionModal?.(verseKey, versions)
        break
      }

      case OPEN_VERSE_TAGS_MODAL: {
        onOpenVerseTagsModal?.(action.payload)
        break
      }

      default: {
        break
      }
    }
  }

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
          // webviewDebuggingEnabled: true,
          containerStyle: {
            flex: 1,
            backgroundColor: theme.colors.reverse,
            ...(Platform.OS === 'android' && {
              marginTop: insets.top,
            }),
          },
        }}
        verses={verses}
        parallelVerses={parallelVerses}
        parallelColumnWidth={parallelColumnWidth}
        parallelDisplayMode={parallelDisplayMode}
        focusVerses={focusVerses}
        secondaryVerses={secondaryVerses}
        selectedVerses={selectedVerses}
        highlightedVerses={highlightedVerses}
        notedVerses={notedVerses}
        bookmarkedVerses={bookmarkedVerses}
        linkedVerses={linkedVerses}
        wordAnnotations={wordAnnotations}
        settings={settings}
        verseToScroll={verseToScroll}
        isReadOnly={isReadOnly}
        version={version}
        pericopeChapter={pericopeChapter}
        book={book}
        chapter={chapter}
        isSelectionMode={isSelectionMode}
        selectedCode={selectedCode}
        comments={comments}
        dispatch={dispatch}
        translations={translations}
        annotationMode={annotationMode}
        clearSelectionTrigger={clearSelectionTrigger}
        applyAnnotationTrigger={applyAnnotationTrigger}
        eraseSelectionTrigger={eraseSelectionTrigger}
        clearAnnotationSelectionTrigger={clearAnnotationSelectionTrigger}
        selectedAnnotationId={selectedAnnotationId}
        safeAreaTop={Platform.OS === 'ios' ? insets.top : 0}
        wordAnnotationsInOtherVersions={wordAnnotationsInOtherVersions}
        taggedVersesInChapter={taggedVersesInChapter}
        versesWithNonHighlightTags={versesWithNonHighlightTags}
        redWords={redWords}
      />
      {Platform.OS === 'android' && Platform.Version < 30 && (
        <HelpTip
          id="bible-dom-wrapper-android"
          description={t('tips.bible-dom-wrapper-android')}
          type="warning"
          position="absolute"
          left={0}
          right={0}
          top={HEADER_HEIGHT + insets.top}
        />
      )}
    </Box>
  )
}
