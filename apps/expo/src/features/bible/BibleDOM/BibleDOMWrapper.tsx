import { getPassageContextHeaderHeight } from '../passagePreviewPresentation'
import type { PlanDayStepView } from './PlanDayStepCard'
import type { LabeledCommentaryChip } from './InlineCommentaryChips'
import type { FocusStudyTranslations, FocusVerseStudy } from '../focusStudy/focusVerseStudyTypes'
import { getEntityChipListState } from '~common/entityChips'
import type { TagsObj } from '~common/types'
import { createVerseEndpoint } from '~features/studyRelations/endpoints'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { webFontFamily } from '~helpers/webFontFamily'
import { useTheme } from '~themes/ThemeProvider'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, Platform, useWindowDimensions, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isBibleOverlayOpenAtom, isFullScreenBibleAtom } from 'src/state/app'
import { isRepairingBibleDatabaseAtom } from '~state/bibleDatabaseRepair'
import {
  BibleContextDisplayMode,
  ParallelColumnWidth,
  ParallelDisplayMode,
  VersionCode,
} from 'src/state/tabs'
import BibleDOMComponent from './BibleDOMComponent'
import {
  sortVersesToTags,
  getAnnotationNotesInfo,
  getVerseRelationsMetadata,
} from './computeVerseMetadata'
import { Book } from '~assets/bible_versions/books-desc'
import type { Bookmark } from '~common/types'
import { Pericope, SelectedCode, Tag, Verse, VerseIds, StudyNavigateBibleType } from '~common/types'
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
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'
import type { EntityPortraitSources } from '~features/lexique/entityPortraits'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { AnnotationType } from '../hooks/useAnnotationMode'
import { BibleDOMTranslations } from './TranslationsContext'
import AndroidWebViewWarningModal from '../AndroidWebViewWarningModal'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import type { ResolvedPassageMediaChapter } from '../passageMedia'
import useConnection from '~helpers/useConnection'
import { getOriginalBookTitle } from '~helpers/originalBookTitles'
import { getReadingBookName, translateForReading } from '~helpers/readingLanguage'
import type { ReaderIntentHandler, ReaderPageSignal } from '../readerIntent/types'

export type ParallelVerse = {
  id: VersionCode
  verses: Verse[]
  error?: BibleError
  interlinearMode?: InterlinearMode
  // Not loaded yet for the chapter shown: the column holds a placeholder
  isLoading?: boolean
}

/** A Strong or interlinear button of a parallel column title. */
export type ColumnTextModeControl = {
  active: boolean
}

/** The text-mode buttons of one parallel column; a version without the mode has none. */
export type ColumnTextModeControls = {
  strong?: ColumnTextModeControl
  interlinear?: ColumnTextModeControl
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** What the page tells of itself, once the bridge has carried it (ADR-0098). */
const decodePageSignal = (value: unknown): ReaderPageSignal | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'mounted':
      return { kind: value.kind }
    case 'overlay-open':
      return typeof value.open === 'boolean' ? { kind: value.kind, open: value.open } : undefined
    case 'toast':
      if (typeof value.message !== 'string' || !value.message) return undefined
      if (
        value.type !== undefined &&
        !['info', 'warning', 'error'].includes(value.type as string)
      ) {
        return undefined
      }
      return {
        kind: value.kind,
        message: value.message,
        ...(value.type !== undefined && { type: value.type as 'info' | 'warning' | 'error' }),
      }
    default:
      return undefined
  }
}

/**
 * Prevents rapid empty→loaded prop updates on the Expo DOM bridge.
 * Skips updates when loading with no verses, so the DOM component
 * only receives the real data once it's ready. The parallel versions travel
 * with the verses they sit next to: the reader never pairs a chapter with
 * the columns of another.
 */
function useStabilizedVerses(verses: Verse[], parallelVerses: ParallelVerse[], isLoading: boolean) {
  const [stable, setStable] = useState({ verses, parallelVerses })

  useEffect(() => {
    if (isLoading && verses.length === 0) return
    setStable({ verses, parallelVerses })
  }, [verses, parallelVerses, isLoading])

  return stable
}

const DOM_WEBVIEW_BACKGROUND_COLOR = 'transparent'
const DOM_WEBVIEW_INITIAL_SCRIPT =
  "document.documentElement.style.backgroundColor='transparent';document.body.style.backgroundColor='transparent';document.body.style.margin='0';true;"

export type WebViewProps = {
  /** The Tab shown: the page stamps it on each Reader intent. */
  tabId: string
  /** Every Reader intent of the page goes through here (ADR-0098). */
  onReaderIntent: ReaderIntentHandler
  book: Book
  chapter: number
  isLoading: boolean
  personalBibleDataEnabled?: boolean
  setSelectedVerse: (selectedVerse: number) => void
  version: VersionCode
  interlinearMode?: InterlinearMode
  contextDisplayMode: BibleContextDisplayMode
  isSelectionMode: StudyNavigateBibleType | undefined
  verses: Verse[]
  parallelVerses: ParallelVerse[]
  parallelColumnWidth?: ParallelColumnWidth
  parallelDisplayMode?: ParallelDisplayMode
  /** Parallel reading: the Strong and interlinear buttons of each column, 0 being the main one. */
  columnTextModeControls?: ColumnTextModeControls[]

  focusVerses: (string | number)[] | undefined
  selectedVerses: VerseIds
  /** The version the selected verses belong to (parallel reading). */
  selectedVersesVersion?: VersionCode
  highlightedVerses: HighlightsObj
  notedVerses: NotesObj
  allNotes: NotesObj
  bookmarkedVerses: Record<number, Bookmark>
  linkedVerses: LinksObj
  allLinks: LinksObj
  studyRelations: StudyRelationsObj
  wordAnnotations: WordAnnotationsObj
  settings: RootState['user']['bible']['settings']
  verseNavigationRequest?: number
  verseToScroll: number | undefined
  pericopeChapter: PericopeChapter
  // Section headings of the parallel versions, for the displayed chapter
  parallelPericopeChapters?: Record<string, PericopeChapter | undefined>
  passageMedia: ResolvedPassageMediaChapter
  selectedCode: SelectedCode | null
  /** Plan mode shows its banner under the header, focus or not. */
  inPlan?: boolean
  /** Plan mode: the way on to the next element of the day, under the passage's last chapter. */
  planDayStep?: PlanDayStepView
  // Annotation mode props
  annotationMode?: boolean
  clearSelectionTrigger?: number
  applyAnnotationTrigger?: { count: number; color: string; type: AnnotationType }
  eraseSelectionTrigger?: number
  clearAnnotationSelectionTrigger?: number
  selectedAnnotationId?: string | null
  // Cross-version annotations
  wordAnnotationsInOtherVersions?: Record<string, CrossVersionAnnotation[]>
  // Verse tags
  taggedVersesInChapter?: Record<number, number>
  versesWithNonHighlightTags?: Record<number, boolean>
  isFormSheet?: boolean
  // Red words data
  redWords?: Record<string, { start: number; end: number }[]> | null
  // Red words of the parallel versions, by version
  parallelRedWords?: Record<string, Record<string, { start: number; end: number }[]> | null>
  inlineCommentaries?: {
    introduction: LabeledCommentaryChip[]
    afterVerses: Record<number, LabeledCommentaryChip[]>
  }
  chapterEntities: StrongLexiconChapterEntity[]
  chapterEntitiesLoaded: boolean
  /** The portraits of the chapter's entities, by unique name (ADR-0089). */
  chapterEntityPortraits: EntityPortraitSources
  /** What the reader gathers under the studied verse of a focus (ADR-0088). */
  focusStudy?: FocusVerseStudy
  focusStudyTranslations?: FocusStudyTranslations
  chapterEntityModuleStatus: StrongLexiconModuleAvailability['status'] | null
  chapterEntityDownloadState: BibleDOMDownloadState
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
  activeEndpoint?: RelationEndpoint
  targetEndpoint: RelationEndpoint
  targetType: RelationEndpoint['type']
  label: string
  targetIsAvailable: boolean
  targetEntityExists: boolean
  verseIds: string[]
  updatedAt: number
}

export const BibleDOMWrapper = ({
  tabId,
  onReaderIntent,
  verses,
  parallelVerses,
  parallelColumnWidth = 75,
  parallelDisplayMode = 'horizontal',
  columnTextModeControls,
  focusVerses,
  selectedVerses,
  selectedVersesVersion,
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
  verseNavigationRequest,
  contextDisplayMode,
  version,
  interlinearMode,
  pericopeChapter,
  passageMedia,
  book,
  chapter,
  isSelectionMode,
  selectedCode,
  inPlan,
  planDayStep,
  annotationMode,
  clearSelectionTrigger,
  applyAnnotationTrigger,
  eraseSelectionTrigger,
  clearAnnotationSelectionTrigger,
  selectedAnnotationId,
  wordAnnotationsInOtherVersions,
  taggedVersesInChapter,
  versesWithNonHighlightTags,
  isFormSheet,
  redWords,
  parallelRedWords,
  parallelPericopeChapters,
  inlineCommentaries,
  chapterEntities,
  chapterEntitiesLoaded,
  chapterEntityPortraits,
  focusStudy,
  focusStudyTranslations,
  chapterEntityModuleStatus,
  chapterEntityDownloadState,
  isLoading,
  personalBibleDataEnabled = true,
  error,
}: WebViewProps) => {
  const keepControlsVisible = useWindowDimensions().width >= 768
  const isConnected = useConnection()

  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)
  useEffect(() => {
    if (keepControlsVisible) setIsFullScreenBible(false)
  }, [keepControlsVisible, setIsFullScreenBible])

  const setIsBibleOverlayOpen = useSetAtom(isBibleOverlayOpenAtom)
  const isBibleOverlayOpenRef = useRef(false)
  const wasFullScreenBeforeOverlayRef = useRef(false)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const focusedEndpoint =
    personalBibleDataEnabled && focusVerses?.length
      ? createVerseEndpoint(
          focusVerses.map(verse => `${book.Numero}-${chapter}-${verse}`),
          undefined,
          version
        )
      : null
  const focusedRelationCount = useRelationCount(focusedEndpoint)
  const openFocusedRelations = useOpenEntityRelations()
  const focusedTags: TagsObj = {}
  for (const verse of personalBibleDataEnabled ? (focusVerses ?? []) : []) {
    Object.assign(focusedTags, highlightedVerses[`${book.Numero}-${chapter}-${verse}`]?.tags)
  }
  const focusedMetadataItems = getEntityChipListState({
    tags: focusedTags,
    relationCount: focusedRelationCount,
    canOpenRelations: !!focusedEndpoint,
  }).items

  const pushRouteOnce = usePushRouteOnce()
  const isResettingDatabase = useAtomValue(isRepairingBibleDatabaseAtom)
  const errorDownloadItemId = createOfflineCopyId({
    kind: 'bible',
    versionId: error?.version ?? version,
  })
  const queueState = useDownloadItemStatus(errorDownloadItemId)
  const errorDownloadState: BibleDOMDownloadState | undefined =
    error && Platform.OS !== 'web'
      ? {
          status: queueState?.status,
          progress:
            queueState?.status === 'inserting'
              ? (queueState.insertProgress ?? 0)
              : (queueState?.downloadProgress ?? 0),
          error: queueState?.error,
        }
      : undefined

  const { verses: stableVerses, parallelVerses: stableParallelVerses } = useStabilizedVerses(
    verses,
    parallelVerses,
    isLoading
  )

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
    fontFamily: Platform.OS === 'web' ? webFontFamily(settings.fontFamily) : settings.fontFamily,
    colors: { [settings.theme]: settings.colors[settings.theme] },
  } as typeof settings

  // Translations for the DOM component (which can't access i18n directly)
  const translations: BibleDOMTranslations = {
    parallelVersionNotFound: t('bible.error.parallelVersionNotFound'),
    parallelChapterNotFound: t('bible.error.parallelChapterNotFound'),
    parallelLoadError: t('bible.error.parallelLoadError'),
    exitFocus: t('tab.exitFocus'),
    chooseStrongDisplay: t('Choisir l’affichage de la Bible Strong'),
    originalTextOptions: t('Options du texte original'),
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
    passageMediaOpenInYoutube: t('bible.passageMedia.openInYoutube'),
    passageMediaBookName: t(book.Nom),
    passageMediaChapter: chapter,
    passageMediaSections: {
      introduction: t('bible.passageMedia.sections.introduction'),
      passages: t('bible.passageMedia.sections.passages'),
      chapterResources: t('bible.passageMedia.sections.chapterResources'),
    },
    // The frame of the text speaks the version's language (the app's for Hebrew, Greek, Latin)
    chapterOpening: {
      bookName: getReadingBookName(book, version),
      chapter: translateForReading('Chapitre', version),
      psalm: translateForReading('Psaume', version),
      originalTitle: getOriginalBookTitle(book.Numero, version),
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
    // Keeps {{name}} for the web view, which puts each entity's name in it.
    openEntity: t('bible.chapterEntities.open', { interpolation: { skipOnVariables: true } }),
    openMap: t('bible.chapterEntities.openMap'),
    empty: t('bible.chapterEntities.empty'),
    downloadTitle: t('strongLexicon.biblicalEntities'),
    downloadDescription: t('strongLexicon.biblicalEntitiesDescription'),
    downloading: t('bible.error.downloading'),
    downloadFailed: t('bible.chapterEntities.downloadFailed'),
    dismiss: t('bible.chapterEntities.dismissAccessibility'),
  }
  // The signals of the page itself: no rule refuses them, and nothing answers them.
  const handlePageSignal = (value: unknown) => {
    const signal = decodePageSignal(value)
    if (!signal) {
      appLogger.captureError(
        'webview',
        'reader_page_signal.rejected',
        new Error('READER_PAGE_SIGNAL_REJECTED'),
        { kind: isRecord(value) ? value.kind : undefined }
      )
      return
    }
    appLogger.debug('webview', 'reader_page_signal', { kind: signal.kind })

    switch (signal.kind) {
      case 'overlay-open': {
        if (signal.open === isBibleOverlayOpenRef.current) return
        if (signal.open) {
          wasFullScreenBeforeOverlayRef.current = getDefaultStore().get(isFullScreenBibleAtom)
        }
        isBibleOverlayOpenRef.current = signal.open
        setIsBibleOverlayOpen(signal.open)
        setIsFullScreenBible(signal.open ? true : wasFullScreenBeforeOverlayRef.current)
        return
      }
      case 'toast': {
        const message = t(signal.message)
        if (signal.type === 'warning') toast.warning(message)
        else if (signal.type === 'error') toast.error(message)
        else toast.info(message)
        return
      }
      case 'mounted': {
        appLogger.info('webview', 'bible_dom.mounted', {
          version,
          book: book.Numero,
          chapter,
        })
        setIsDOMMounted(true)
        return
      }
    }
  }

  // Pre-compute verse metadata on native side (avoids DOM JS thread work)
  const taggedVerses = sortVersesToTags(highlightedVerses)
  // Word annotations come filtered to the versions on screen: every one of them counts.
  const { versesWithAnnotationNotes, annotationNotesCountByVerse } = getAnnotationNotesInfo(
    versesToSend,
    wordAnnotations
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
      wordAnnotations,
    }
  )
  const TOP_INSET = isFormSheet ? 0 : insets.top
  const headerHeight =
    (isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT) +
    getPassageContextHeaderHeight(focusVerses, annotationMode, inPlan)
  const nativeLayerZIndex = Platform.OS === 'web' ? 0 : -1
  const webInlineScrollStyle =
    Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
        } satisfies ViewStyle & {
          overflowY: 'auto'
          overscrollBehaviorY: 'contain'
          WebkitOverflowScrolling: 'touch'
        })
      : undefined

  return (
    <Box
      className="overflow-hidden border-continuous"
      style={{
        backgroundColor: theme.colors.reverse,
        zIndex: nativeLayerZIndex,
        flex: 1,
        ...webInlineScrollStyle,
      }}
    >
      <BibleDOMComponent
        tabId={tabId}
        onReaderIntent={onReaderIntent}
        focusedMetadataItems={focusedMetadataItems}
        onFocusedMetadataPress={async (type, id) => {
          if (type === 'relation' && focusedEndpoint) openFocusedRelations(focusedEndpoint)
          else if (type === 'tag') pushRouteOnce({ pathname: '/tag', params: { tagId: id } })
        }}
        dom={{
          useExpoDOMWebView: false,
          webviewDebuggingEnabled: __DEV__,
          allowsInlineMediaPlayback: true,
          allowsFullscreenVideo: true,
          mediaPlaybackRequiresUserAction: false,
          sharedCookiesEnabled: true,
          thirdPartyCookiesEnabled: true,
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
          // Android only. Expo still reloads the WebView after this handler runs.
          onRenderProcessGone: ({ nativeEvent }) => {
            appLogger.captureError(
              'webview',
              'bible_dom.render_process_gone',
              new Error('BIBLE_DOM_RENDER_PROCESS_GONE'),
              {
                errorCode: nativeEvent.didCrash ? 'RENDERER_CRASHED' : 'RENDERER_KILLED',
                appLifecycle: AppState.currentState,
                isDOMMounted,
              }
            )
          },
        }}
        verses={versesToSend}
        parallelVerses={stableParallelVerses}
        parallelColumnWidth={parallelColumnWidth}
        parallelDisplayMode={parallelDisplayMode}
        columnTextModeControls={columnTextModeControls}
        focusVerses={focusVerses}
        selectedVerses={selectedVerses}
        selectedVersesVersion={selectedVersesVersion ?? version}
        highlightedVerses={highlightedVerses}
        bookmarkedVerses={bookmarkedVerses}
        wordAnnotations={wordAnnotations}
        settings={trimmedSettings}
        verseToScroll={verseToScroll}
        verseNavigationRequest={verseNavigationRequest}
        contextDisplayMode={contextDisplayMode}
        version={version}
        interlinearMode={interlinearMode}
        pericopeChapter={pericopeChapter}
        passageMedia={passageMedia}
        book={book}
        chapter={chapter}
        isSelectionMode={isSelectionMode}
        selectedCode={selectedCode}
        onPageSignal={handlePageSignal}
        translations={translations}
        chapterEntityTranslations={chapterEntityTranslations}
        inPlan={inPlan}
        planDayStep={planDayStep}
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
        parallelRedWords={parallelRedWords}
        parallelPericopeChapters={parallelPericopeChapters}
        inlineCommentaries={inlineCommentaries}
        chapterEntities={chapterEntities}
        chapterEntitiesLoaded={chapterEntitiesLoaded}
        chapterEntityPortraits={chapterEntityPortraits}
        focusStudy={focusStudy}
        focusStudyTranslations={focusStudyTranslations}
        chapterEntityModuleStatus={chapterEntityModuleStatus}
        chapterEntityDownloadState={chapterEntityDownloadState}
        error={error}
        errorDownloadState={errorDownloadState}
        onlineOnly={Platform.OS === 'web'}
        isResettingDatabase={isResettingDatabase}
        taggedVerses={taggedVerses}
        versesWithAnnotationNotes={versesWithAnnotationNotes}
        annotationNotesCountByVerse={annotationNotesCountByVerse}
        relationItemsCount={relationMetadata.counts}
        relationItemsText={relationMetadata.items}
        annotationRelationItems={relationMetadata.annotationItems}
        isFormSheet={isFormSheet}
        keepControlsVisible={keepControlsVisible}
        isConnected={isConnected}
      />
      {Platform.OS === 'android' && Number(Platform.Version) < 30 && (
        <AndroidWebViewWarningModal top={headerHeight + TOP_INSET} />
      )}
    </Box>
  )
}
