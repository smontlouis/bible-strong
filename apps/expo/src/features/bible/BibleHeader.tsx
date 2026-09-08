import DisplayModeTrigger from './DisplayModeTrigger'
import BibleSelectorTrigger from './BibleSelectorTrigger'
import BibleBookmarkTrigger from '~features/bookmarks/BibleBookmarkTrigger'
import BibleOptionsMenu from './BibleOptionsMenu'
import { PAGE_CONTENT_MAX_WIDTH } from '~common/ui/PageContent'
import { useEffect, useRef } from 'react'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useRouter } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { FadeIn, FadeOut } from 'react-native-reanimated'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { isFullScreenBibleAtom } from 'src/state/app'
import {
  BibleTab,
  getBibleContextDisplayMode,
  parallelColumnWidthAtom,
  parallelDisplayModeAtom,
  useBibleTabActions,
} from 'src/state/tabs'
import Back from '~common/Back'
import EntityChipList from '~common/EntityChipList'
import ParallelIcon from '~common/ParallelIcon'
import { type SheetRef } from '~common/sheet'
import type { TagsObj } from '~common/types'
import Box, {
  AnimatedBox,
  AnimatedTouchableBox,
  AnimatedVStack,
  HStack,
  TouchableBox,
} from '~common/ui/Box'
import { FormSheetHandle } from '~common/ui/FormSheetScreen'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text, { AnimatedText } from '~common/ui/Text'
import Progress from '~common/ui/Progress'
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
} from '~features/app-switcher/utils/constants'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import BookmarkModal from '~features/bookmarks/BookmarkModal'
import { createVerseEndpoint } from '~features/studyRelations/domain'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import generateUUID from '~helpers/generateUUID'
import truncate from '~helpers/truncate'
import useDimensions from '~helpers/useDimensions'
import verseToReference from '~helpers/verseToReference'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { RootState } from '~redux/modules/reducer'
import { makeSelectBookmarkForChapter } from '~redux/selectors/bookmarks'
import { useBookAndVersionSelector } from './BookSelectorSheet/BookSelectorSheetProvider'
import PassageExportSheet from './passageExport/PassageExportSheet'
import { VerseSelectorPopup } from './VerseSelectorPopup'
import { shouldShowBibleBackButton } from './bibleHeaderNavigation'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import StrongMark from './StrongMark'
import {
  isInterlinearCapableBibleVersion,
  isInterlinearModeEnabled,
} from '~helpers/interlinearBiblePublications'
import { downloadItemStatesAtom } from '~state/downloadQueue'
import { getBibleModeAcquisitionPresentation } from '~helpers/bibleModeAcquisition'
import InterlinearMark from './InterlinearMark'
import InterlinearModeSelectorSheet from './InterlinearModeSelectorSheet'
import StrongModeSelectorSheet from './StrongModeSelectorSheet'
import { useBibleModeAcquisitionCompletion } from './useBibleModeAcquisitionCompletion'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
interface BibleHeaderProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  isFormSheet?: boolean
  onBibleParamsClick: () => void
  onExitAnnotationMode?: () => void
  annotationModeEnabled?: boolean
  hidePersonalBibleData?: boolean
  onEditFocusTags?: () => void
  isInTab?: boolean
  coverage?: BibleVersionCoverage
}

const Header = ({
  isFormSheet,
  bibleAtom,
  onBibleParamsClick,
  onExitAnnotationMode,
  annotationModeEnabled,
  hidePersonalBibleData = false,
  onEditFocusTags,
  isInTab,
  coverage,
}: BibleHeaderProps) => {
  const router = useRouter()
  const { t } = useTranslation()
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400
  const actions = useBibleTabActions(bibleAtom)
  const insets = useSafeAreaInsets()
  const { openBookSelector, openVersionSelector } = useBookAndVersionSelector()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)
  const columnWidth = useAtomValue(parallelColumnWidthAtom)
  const setColumnWidth = useSetAtom(parallelColumnWidthAtom)
  const displayMode = useAtomValue(parallelDisplayModeAtom)
  const setDisplayMode = useSetAtom(parallelDisplayModeAtom)
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = shouldShowBibleBackButton({
    isFormSheet,
    isInTab,
    canGoBackInStack,
  })
  const openInNewTab = useOpenInNewTab()
  const openEntityRelations = useOpenEntityRelations()

  // Bookmark ref
  const bookmarkModalRef = useRef<SheetRef>(null)
  const exportSheetRef = useRef<SheetRef>(null)
  const interlinearModeSheetRef = useRef<SheetRef>(null)
  const strongModeSheetRef = useRef<SheetRef>(null)
  const bible = useAtomValue(bibleAtom)
  const contextDisplayMode = getBibleContextDisplayMode(bible.data)
  const isContextFocused = contextDisplayMode === 'focused'
  const {
    selectedBook: book,
    selectedChapter: chapter,
    selectedVersion: version,
    selectedVerses,
    isSelectionMode,
    parallelVersions,
    focusVerses,
    strongMode = 'hidden',
    interlinearMode = 'hidden',
    pendingModeAcquisition,
  } = bible.data
  const bookNumber = book.Numero
  const bookName = book.Nom
  const isParallel = parallelVersions.length > 0
  const displayVerses = focusVerses
  const downloadStates = useAtomValue(downloadItemStatesAtom)
  const acquisitionPresentation = getBibleModeAcquisitionPresentation(
    pendingModeAcquisition,
    downloadStates
  )
  const isInterlinearDownloadVisible =
    interlinearMode === 'hidden' &&
    pendingModeAcquisition?.kind === 'interlinear' &&
    (acquisitionPresentation.status === 'active' || acquisitionPresentation.status === 'completed')
  const isStrongDownloadVisible =
    strongMode === 'hidden' &&
    pendingModeAcquisition?.kind === 'strong' &&
    pendingModeAcquisition.versionId === version &&
    (acquisitionPresentation.status === 'active' || acquisitionPresentation.status === 'completed')

  useBibleModeAcquisitionCompletion({
    acquisition: pendingModeAcquisition,
    finish: actions.finishBibleModeAcquisition,
    onSucceeded: acquisition => {
      const sheetRef = acquisition.kind === 'strong' ? strongModeSheetRef : interlinearModeSheetRef
      sheetRef.current?.dismiss()
    },
  })

  // Check if verses are selected
  const hasSelectedVerses =
    !hidePersonalBibleData && selectedVerses && Object.keys(selectedVerses).length > 0
  const selectedVersesReference = verseToReference(selectedVerses)

  // Check if current chapter has a bookmark
  const selectBookmarkForChapter = makeSelectBookmarkForChapter()
  const storedCurrentChapterBookmark = useSelector((state: RootState) =>
    selectBookmarkForChapter(state, bookNumber, chapter)
  )
  const currentChapterBookmark = hidePersonalBibleData ? undefined : storedCurrentChapterBookmark

  const hasFocusVerses = focusVerses && focusVerses.length > 0
  const focusedReference = hasFocusVerses
    ? verseToReference({ bookNum: bookNumber, chapterNum: chapter, verses: displayVerses })
    : ''
  const focusedVerseEndpoint = hasFocusVerses
    ? createVerseEndpoint(
        focusVerses.map(focusVerse => `${bookNumber}-${chapter}-${focusVerse}`),
        focusedReference,
        version
      )
    : null
  const storedFocusedVerseRelationCount = useRelationCount(focusedVerseEndpoint)
  const focusedVerseRelationCount = hidePersonalBibleData ? 0 : storedFocusedVerseRelationCount
  const highlights = useSelector((state: RootState) => state.user.bible.highlights)
  const focusedVerseTags = (
    hasFocusVerses && !hidePersonalBibleData ? focusVerses : []
  ).reduce<TagsObj>((acc, focusVerse) => {
    const verseKey = `${bookNumber}-${chapter}-${focusVerse}`
    const tags = highlights[verseKey]?.tags
    return tags ? { ...acc, ...tags } : acc
  }, {})
  const hasFocusedVerseTags = Object.keys(focusedVerseTags).length > 0
  const hasFocusEntityChips = hasFocusedVerseTags || focusedVerseRelationCount > 0

  useEffect(() => {
    const { selectedBook, selectedChapter, selectedVersion, focusVerses } = bible.data
    const ref = verseToReference({
      bookNum: selectedBook.Numero,
      chapterNum: selectedChapter,
      verses: focusVerses,
    })
    actions.setTitle(`${ref} - ${selectedVersion}`)
  }, [actions, bible])

  const { addParallelVersion, removeParallelVersion, removeAllParallelVersions } = actions

  const isHeaderCollapsed = !isFormSheet && isFullScreenBible
  const headerHeight = isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT
  const focusedHeaderMinHeight = headerHeight + (hasFocusVerses && hasFocusEntityChips ? 10 : 0)
  const fullScreenOpacity = isHeaderCollapsed ? 0 : 1
  const fullScreenTranslateY = isHeaderCollapsed ? -4 : 0
  const TOP_INSET = isFormSheet ? 0 : insets.top

  const opacityTransitionStyle = {
    opacity: fullScreenOpacity,
    transitionProperty: 'opacity',
    transitionDuration: 300,
  } as const
  const nativeHeaderZIndex = Platform.OS === 'web' ? 1 : undefined

  const translateYTransitionStyle = {
    transform: [{ translateY: fullScreenTranslateY }],
    transitionProperty: 'transform',
    transitionDuration: 300,
  } as const

  const openInBibleTab = () => {
    openInNewTab({
      ...bible,
      id: `bible-${generateUUID()}`,
      data: {
        ...bible.data,
      },
    })
  }

  const openFocusedVerseRelations = () => {
    if (!focusedVerseEndpoint) return
    openEntityRelations(focusedVerseEndpoint)
  }

  const isVerticalParallelMode = displayMode === 'vertical'
  const nextColumnWidth = columnWidth === 50 ? 75 : columnWidth === 75 ? 100 : 50
  const toggleFocusContext = () => {
    if (isContextFocused) actions.expandContext()
    else actions.collapseContext()
  }

  const focusMenuActions: MenuAction[] = [
    {
      id: 'toggle-context',
      title: isContextFocused ? t('tab.readWholeChapter') : t('tab.closeContext'),
      image: isContextFocused
        ? 'arrow.up.left.and.arrow.down.right'
        : 'arrow.down.right.and.arrow.up.left',
    },
    ...(hasFocusVerses && !hidePersonalBibleData && onEditFocusTags
      ? [
          {
            id: 'tags',
            title: t('Éditer les tags'),
            image: 'tag' as const,
          },
        ]
      : []),
    ...(focusedVerseEndpoint && !hidePersonalBibleData
      ? [
          {
            id: 'relations',
            title: t('Éditer les relations'),
            image: 'arrow.triangle.merge' as const,
          },
        ]
      : []),
    {
      id: 'export',
      title: t('passageExport.menuAction'),
      image: 'square.and.arrow.up',
    },
    {
      id: 'open-tab',
      title: t('tab.openInNewTab'),
      image: 'arrow.up.forward.square',
    },
    {
      id: 'clear-focus',
      title: t('Quitter le mode focus'),
      image: 'xmark',
    },
  ]

  const parallelMenuActions: MenuAction[] = [
    {
      id: 'main-version',
      title: `${version} - ${t('Version principale')}`,
      image: 'book',
      attributes: { disabled: true },
    },
    ...parallelVersions.map((parallelVersion, index) => ({
      id: `remove-version-${index}`,
      title: `${parallelVersion} - ${t('Retirer')}`,
      image: 'xmark.circle' as const,
      attributes: { destructive: true },
    })),
    ...(parallelVersions.length < 3
      ? [
          {
            id: 'add-version',
            title: t('Ajouter une version'),
            image: 'plus.circle' as const,
          },
        ]
      : []),
    {
      id: 'toggle-display-mode',
      title: isVerticalParallelMode ? t('Affichage vertical') : t('Affichage horizontal'),
      image: isVerticalParallelMode ? 'arrow.down' : 'arrow.right',
    },
    ...(isVerticalParallelMode
      ? []
      : [
          {
            id: 'toggle-column-width',
            title: `${t('Largeur des colonnes')} (${columnWidth}%)`,
            image: 'gearshape' as const,
          },
        ]),
    {
      id: 'exit-parallel',
      title: t('Sortir du mode parallèle'),
      image: 'rectangle.portrait.and.arrow.right',
      attributes: { destructive: true },
    },
  ]

  const mainMenuActions: MenuAction[] = [
    { id: 'params', title: t('Police et paramêtres'), image: 'textformat' },
    {
      id: 'parallel',
      title: t('Affichage parallèle'),
      image: 'rectangle.split.2x1',
      state: isParallel ? 'on' : 'off',
    },
    { id: 'history', title: t('history.title'), image: 'clock.arrow.circlepath' },
    ...(!hidePersonalBibleData
      ? [
          {
            id: 'bookmark',
            title: currentChapterBookmark
              ? t('Modifier le marque-page')
              : t('Ajouter un marque-page'),
            image: 'bookmark' as const,
          },
        ]
      : []),
    {
      id: 'export',
      title: t('passageExport.menuAction'),
      image: 'square.and.arrow.up',
    },
    {
      id: 'open-tab',
      title: t('tab.openInNewTab'),
      image: 'arrow.up.forward.square',
    },
  ]

  const strongModeButton = isStrongCapableBibleVersion(version) ? (
    <DisplayModeTrigger
      kind="strong"
      bibleAtom={bibleAtom}
      className="overflow-hidden border-continuous items-center justify-center w-[40px] h-[40px]"
      onPress={() => strongModeSheetRef.current?.present()}
      disabled={isStrongDownloadVisible}
      accessibilityRole="button"
      accessibilityLabel={
        isStrongDownloadVisible
          ? t('Téléchargement en cours')
          : t('Choisir l’affichage de la Bible Strong')
      }
      accessibilityState={{
        disabled: isStrongDownloadVisible,
        selected: strongMode !== 'hidden',
      }}
      style={[
        { opacity: isStrongDownloadVisible ? 0.6 : 1 },
        [
          { opacity: isStrongDownloadVisible ? 0.6 : 1 },
          {
            opacity: fullScreenOpacity,
            transitionProperty: 'opacity',
            transitionDuration: 300,
          },
        ],
      ]}
    >
      {isStrongDownloadVisible ? (
        <Progress
          progress={Math.max(acquisitionPresentation.progress, 0.04)}
          size={22}
          thickness={2.5}
        />
      ) : (
        <StrongMark highlighted={strongMode !== 'hidden'} />
      )}
    </DisplayModeTrigger>
  ) : null

  const interlinearModeButton = isInterlinearCapableBibleVersion(version) ? (
    <DisplayModeTrigger
      kind="interlinear"
      bibleAtom={bibleAtom}
      className="overflow-hidden border-continuous items-center justify-center w-[40px] h-[40px]"
      onPress={() => interlinearModeSheetRef.current?.present()}
      disabled={isInterlinearDownloadVisible}
      accessibilityRole="button"
      accessibilityLabel={
        isInterlinearDownloadVisible ? t('Téléchargement en cours') : t('Options du texte original')
      }
      accessibilityState={{
        disabled: isInterlinearDownloadVisible,
        selected: isInterlinearModeEnabled(interlinearMode),
      }}
      style={[
        { opacity: isInterlinearDownloadVisible ? 0.6 : 1 },
        [{ opacity: isInterlinearDownloadVisible ? 0.6 : 1 }, opacityTransitionStyle],
      ]}
    >
      {isInterlinearDownloadVisible ? (
        <Progress
          progress={Math.max(acquisitionPresentation.progress, 0.04)}
          size={22}
          thickness={2.5}
        />
      ) : (
        <InterlinearMark highlighted={isInterlinearModeEnabled(interlinearMode)} />
      )}
    </DisplayModeTrigger>
  ) : null

  if (annotationModeEnabled) {
    return (
      <AnimatedVStack
        className="border-continuous overflow-visible justify-center w-[100%] bg-primary px-[15px] border-b-[1px] border-border absolute top-[0px] left-[0px]"
        entering={FadeIn}
        exiting={FadeOut}
        key="annotation-mode-header"
        style={{
          paddingTop: TOP_INSET,
          height: headerHeight + TOP_INSET,
          zIndex: nativeHeaderZIndex,
        }}
      >
        {isFormSheet && <FormSheetHandle />}

        <HStack
          className="border-continuous overflow-visible mx-auto items-center w-[100%]"
          style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH }}
        >
          <Box className="w-[80px] h-[40px] justify-center items-start">
            {hasBackButton && (
              <Back
                onGoBack={() => {
                  setIsFullScreenBible(false)
                  console.log('[Bible] onGoBack')
                }}
              >
                <Box className="overflow-hidden border-continuous items-center justify-center w-[50px] h-[32px]">
                  <FeatherIcon name="arrow-left" size={20} color="reverse" />
                </Box>
              </Back>
            )}
          </Box>
          <Box className="overflow-hidden border-continuous flex-[1] min-w-0 items-center justify-center">
            <Text className="font-bold text-reverse text-[14px]" numberOfLines={1}>
              {`${verseToReference({ bookNum: bookNumber, chapterNum: chapter, verses: displayVerses })} - ${version}`}
            </Text>
          </Box>

          <Box className="w-[80px] h-[40px] justify-center items-end">
            <AnimatedTouchableBox
              className="overflow-hidden border-continuous min-h-[40px] justify-center"
              onPress={onExitAnnotationMode}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.exitAnnotationMode')}
            >
              <Box className="overflow-hidden border-continuous bg-reverse rounded-[8px] h-[28px] px-[12px] items-center justify-center">
                <Text className="text-primary font-bold text-[12px]">{t('Terminé')}</Text>
              </Box>
            </AnimatedTouchableBox>
          </Box>
        </HStack>
      </AnimatedVStack>
    )
  }

  if (hasSelectedVerses) {
    return (
      <AnimatedVStack
        className="border-continuous overflow-visible w-[100%] bg-reverse justify-center px-[15px] border-b-[1px] border-border absolute top-[0px] left-[0px]"
        entering={FadeIn}
        exiting={FadeOut}
        key="selected-verses-header"
        style={{
          paddingTop: TOP_INSET,
          height: headerHeight + TOP_INSET,
          zIndex: nativeHeaderZIndex,
        }}
      >
        {isFormSheet && <FormSheetHandle />}

        <HStack
          className="overflow-hidden border-continuous mx-auto items-center w-[100%]"
          style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH }}
        >
          {hasBackButton && (
            <Back
              onGoBack={() => {
                setIsFullScreenBible(false)
                console.log('[Bible] onGoBack')
              }}
            >
              <Box className="overflow-hidden border-continuous items-center justify-center w-[50px] h-[32px]">
                <FeatherIcon name="arrow-left" size={20} />
              </Box>
            </Back>
          )}
          <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
            <Text className="font-bold text-[14px]">{selectedVersesReference}</Text>
          </Box>
        </HStack>
      </AnimatedVStack>
    )
  }

  return (
    <AnimatedVStack
      className="border-continuous overflow-visible justify-center w-[100%] bg-reverse border-b-[1px] border-border absolute top-[0px] left-[0px]"
      style={[
        { paddingTop: TOP_INSET, zIndex: nativeHeaderZIndex },
        {
          height: isHeaderCollapsed ? 20 + TOP_INSET : undefined,
          minHeight: isHeaderCollapsed ? 20 + TOP_INSET : focusedHeaderMinHeight + TOP_INSET,
          transitionProperty: 'height',
          transitionDuration: 300,
        },
      ]}
      testID="workspace-page-header"
      key="default-header"
      entering={FadeIn}
      exiting={FadeOut}
    >
      {isFormSheet && <FormSheetHandle />}

      <HStack
        className="overflow-hidden border-continuous mx-auto items-center w-[100%]"
        style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH }}
      >
        {hasBackButton ? (
          <Back
            onGoBack={() => {
              setIsFullScreenBible(false)
              console.log('[Bible] onGoBack')
            }}
          >
            <AnimatedBox
              className="overflow-hidden border-continuous items-center justify-center w-[50px] h-[32px]"
              style={translateYTransitionStyle}
            >
              <FeatherIcon name="arrow-left" size={20} />
            </AnimatedBox>
          </Back>
        ) : null}
        {hasFocusVerses ? (
          <>
            <AnimatedBox
              className="overflow-hidden border-continuous flex-[1]"
              style={translateYTransitionStyle}
            >
              <HStack className="overflow-hidden border-continuous px-[15px] items-center justify-between gap-[8px]">
                <Box className="overflow-hidden border-continuous flex-[1]">
                  <Text
                    className="font-bold text-[14px]"
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {`${focusedReference} - ${version}`}
                  </Text>
                  <EntityChipList
                    tags={focusedVerseTags}
                    relationCount={focusedVerseRelationCount}
                    onRelationPress={openFocusedVerseRelations}
                    limit={2}
                  />
                </Box>
                {strongModeButton}
                {interlinearModeButton}
                <BibleOptionsMenu
                  bookNumber={bookNumber}
                  chapter={chapter}
                  version={version}
                  accessibilityLabel={t('accessibility.focusOptions')}
                  actions={focusMenuActions}
                  onPressAction={({ nativeEvent }) => {
                    switch (nativeEvent.event) {
                      case 'toggle-context':
                        toggleFocusContext()
                        break
                      case 'open-tab':
                        openInBibleTab()
                        break
                      case 'tags':
                        onEditFocusTags?.()
                        break
                      case 'relations':
                        openFocusedVerseRelations()
                        break
                      case 'export':
                        exportSheetRef.current?.present()
                        break
                      case 'clear-focus':
                        actions.clearFocusVerses()
                        break
                    }
                  }}
                >
                  <AnimatedBox
                    className="overflow-hidden border-continuous flex-row items-center justify-center w-[76px] h-[28px] bg-light-primary rounded-[12px] gap-[3px]"
                    style={opacityTransitionStyle}
                  >
                    <Text className="text-primary text-[11px] font-bold">Focus</Text>
                    <FeatherIcon name="chevron-down" size={12} color="primary" />
                  </AnimatedBox>
                </BibleOptionsMenu>
                <TouchableBox
                  className="overflow-hidden border-continuous items-center justify-center w-[28px] h-[28px] bg-light-primary rounded-[12px]"
                  onPress={toggleFocusContext}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isContextFocused ? t('tab.readWholeChapter') : t('tab.closeContext')
                  }
                  accessibilityState={{ expanded: !isContextFocused }}
                  style={opacityTransitionStyle}
                >
                  <FeatherIcon
                    name={isContextFocused ? 'maximize-2' : 'minimize-2'}
                    size={14}
                    color="primary"
                  />
                </TouchableBox>
                <TouchableBox
                  className="overflow-hidden border-continuous items-center justify-center w-[28px] h-[28px] bg-light-primary rounded-[12px]"
                  onPress={() => actions.clearFocusVerses()}
                  accessibilityRole="button"
                  accessibilityLabel={t('accessibility.clearFocus')}
                  style={opacityTransitionStyle}
                >
                  <FeatherIcon name="x" size={15} color="primary" />
                </TouchableBox>
              </HStack>
            </AnimatedBox>
          </>
        ) : (
          <>
            <HStack className="overflow-hidden border-continuous items-center gap-[3px] pl-[10px]">
              <HStack className="overflow-hidden border-continuous">
                <BibleSelectorTrigger
                  kind="book"
                  data={getDefaultStore().get(bibleAtom).data}
                  actions={actions}
                  coverage={coverage}
                  className="overflow-hidden border-continuous items-center justify-center pl-[12px] pr-[7px] h-[32px]"
                  onPress={() => {
                    openBookSelector({
                      actions,
                      data: getDefaultStore().get(bibleAtom).data,
                    })
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('accessibility.chooseBookAndChapter', {
                    reference: `${t(bookName)} ${chapter}`,
                  })}
                >
                  <AnimatedBox
                    className="overflow-hidden border-continuous bg-light-grey rounded-tl-[20px] rounded-bl-[20px] absolute left-[0px] bottom-[0px] right-[0px] top-[0px]"
                    style={opacityTransitionStyle}
                  />
                  <AnimatedText className="font-bold text-[14px]" style={translateYTransitionStyle}>
                    {isSmall
                      ? truncate(`${t(bookName)} ${chapter}`, 10)
                      : `${t(bookName)} ${chapter}`}
                  </AnimatedText>
                </BibleSelectorTrigger>
              </HStack>
              <BibleSelectorTrigger
                kind="version"
                data={getDefaultStore().get(bibleAtom).data}
                actions={actions}
                className="overflow-hidden border-continuous items-center justify-center pl-[7px] pr-[12px] h-[32px]"
                onPress={() =>
                  openVersionSelector({
                    actions,
                    data: getDefaultStore().get(bibleAtom).data,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.chooseVersion', { version })}
              >
                <AnimatedBox
                  className="overflow-hidden border-continuous bg-light-grey rounded-tr-[20px] rounded-br-[20px] absolute left-[0px] bottom-[0px] right-[0px] top-[0px]"
                  style={opacityTransitionStyle}
                />
                <AnimatedText className="font-bold text-[14px]" style={translateYTransitionStyle}>
                  {version}
                </AnimatedText>
              </BibleSelectorTrigger>
            </HStack>

            <VerseSelectorPopup bibleAtom={bibleAtom} coverage={coverage} preferCoverage>
              <AnimatedBox
                className="overflow-hidden border-continuous items-center justify-center w-[40px] h-[100%]"
                style={opacityTransitionStyle}
              >
                <FeatherIcon name="chevrons-down" size={20} style={{ opacity: 0.3 }} />
              </AnimatedBox>
            </VerseSelectorPopup>
            {!isSelectionMode && (
              <HStack className="overflow-hidden border-continuous ml-auto items-center">
                {isParallel && (
                  <MenuView
                    accessibilityLabel={t('accessibility.parallelOptions')}
                    actions={parallelMenuActions}
                    onPressAction={({ nativeEvent }) => {
                      if (nativeEvent.event.startsWith('remove-version-')) {
                        const index = Number(nativeEvent.event.replace('remove-version-', ''))
                        removeParallelVersion(index)
                        return
                      }

                      switch (nativeEvent.event) {
                        case 'add-version':
                          addParallelVersion()
                          break
                        case 'toggle-display-mode':
                          setDisplayMode(isVerticalParallelMode ? 'horizontal' : 'vertical')
                          break
                        case 'toggle-column-width':
                          setColumnWidth(nextColumnWidth)
                          break
                        case 'exit-parallel':
                          removeAllParallelVersions()
                          break
                      }
                    }}
                  >
                    <AnimatedBox
                      className="overflow-hidden border-continuous items-center justify-center w-[40px] h-[40px]"
                      style={{
                        opacity: fullScreenOpacity,
                        transitionProperty: 'opacity',
                        transitionDuration: 300,
                      }}
                    >
                      <Box className="border-continuous overflow-visible relative">
                        <ParallelIcon color="primary" />
                        <Box className="overflow-hidden border-continuous absolute bottom-[-2px] right-[-4px] bg-grey rounded-[99px] w-[12px] h-[12px] items-center justify-center">
                          <Text className="text-[9px] text-reverse font-bold">
                            {parallelVersions.length + 1}
                          </Text>
                        </Box>
                      </Box>
                    </AnimatedBox>
                  </MenuView>
                )}

                {strongModeButton}
                {interlinearModeButton}

                {/* Three-dots menu */}
                <BibleOptionsMenu
                  bookNumber={bookNumber}
                  chapter={chapter}
                  version={version}
                  accessibilityLabel={t('accessibility.bibleOptions')}
                  actions={mainMenuActions}
                  onPressAction={({ nativeEvent }) => {
                    switch (nativeEvent.event) {
                      case 'params':
                        onBibleParamsClick()
                        break
                      case 'parallel':
                        if (isParallel) removeAllParallelVersions()
                        else addParallelVersion()
                        break
                      case 'history':
                        router.push('/history')
                        break
                      case 'bookmark':
                        bookmarkModalRef.current?.present()
                        break
                      case 'export':
                        exportSheetRef.current?.present()
                        break
                      case 'open-tab':
                        openInBibleTab()
                        break
                    }
                  }}
                >
                  <AnimatedBox
                    className="overflow-hidden border-continuous items-center justify-center w-[40px] h-[40px]"
                    style={{
                      opacity: fullScreenOpacity,
                      transitionProperty: 'opacity',
                      transitionDuration: 300,
                    }}
                  >
                    <FeatherIcon name="more-vertical" size={18} />
                  </AnimatedBox>
                </BibleOptionsMenu>
                {focusVerses && focusVerses.length > 0 && (
                  <TouchableBox
                    className="overflow-hidden border-continuous items-center justify-center w-[40px] h-[32px]"
                    onPress={() => actions.clearFocusVerses()}
                    accessibilityRole="button"
                    accessibilityLabel={t('accessibility.clearFocus')}
                  >
                    <FeatherIcon name="x" size={20} />
                  </TouchableBox>
                )}
              </HStack>
            )}
          </>
        )}
      </HStack>
      <BookmarkModal
        sheetRef={bookmarkModalRef}
        book={bookNumber}
        chapter={chapter}
        version={version}
        existingBookmark={currentChapterBookmark || undefined}
      />
      <PassageExportSheet
        ref={exportSheetRef}
        sourceType="chapter"
        bookNumber={bookNumber}
        chapterNumber={chapter}
        version={version}
      />
      {isInterlinearCapableBibleVersion(version) && (
        <InterlinearModeSelectorSheet bibleAtom={bibleAtom} sheetRef={interlinearModeSheetRef} />
      )}
      {isStrongCapableBibleVersion(version) && (
        <StrongModeSelectorSheet bibleAtom={bibleAtom} sheetRef={strongModeSheetRef} />
      )}
      {currentChapterBookmark && (
        <Box className="overflow-hidden border-continuous absolute right-[24px] bottom-[-18px]">
          <BibleBookmarkTrigger
            book={bookNumber}
            chapter={chapter}
            version={version}
            onPress={() => bookmarkModalRef.current?.present()}
            accessibilityLabel={t('Modifier le marque-page')}
          >
            <IonIcon name="bookmark" size={24} color={currentChapterBookmark.color} />
          </BibleBookmarkTrigger>
        </Box>
      )}
    </AnimatedVStack>
  )
}

export default Header
