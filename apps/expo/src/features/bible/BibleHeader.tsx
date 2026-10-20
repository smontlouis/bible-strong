import BibleVerseKeyboardDialog from './BibleVerseKeyboardDialog'
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
  getSelectedVersesVersion,
  parallelColumnWidthAtom,
  parallelDisplayModeAtom,
  useBibleTabActions,
} from 'src/state/tabs'
import Back from '~common/Back'
import ParallelIcon from '~common/ParallelIcon'
import { getReadingBookName, getReadingLanguage } from '~helpers/readingLanguage'
import { type SheetRef } from '~common/sheet'
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
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
} from '~features/app-switcher/utils/constants'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import BookmarkModal from '~features/bookmarks/BookmarkModal'
import generateUUID from '~helpers/generateUUID'
import { getChapterShareUrl } from '~helpers/publicSiteLinks'
import { SHARE_LINK_ACTION, shareResourceLink } from '~features/share/resourceShare'
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
import { getPassagePreviewMenuActions } from './passagePreviewPresentation'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import StrongMark from './StrongMark'
import {
  isInterlinearCapableBibleVersion,
  isInterlinearModeEnabled,
} from '~helpers/interlinearBiblePublications'
import InterlinearMark from './InterlinearMark'
import type { BibleTextModeKind } from './BibleTextModeSheets'
import type { BibleTextModeColumn } from '~helpers/bibleColumnTextModes'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
interface BibleHeaderProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  isFormSheet?: boolean
  onBibleParamsClick: () => void
  onExitAnnotationMode?: () => void
  annotationModeEnabled?: boolean
  hidePersonalBibleData?: boolean
  isInTab?: boolean
  coverage?: BibleVersionCoverage
  onNavigateToVerse: (verse: number) => void
  /** Opens the Strong or interlinear sheet of a column: 0 is the main version. */
  onOpenTextMode: (kind: BibleTextModeKind, column: BibleTextModeColumn) => void
}

const Header = ({
  isFormSheet,
  bibleAtom,
  onBibleParamsClick,
  onExitAnnotationMode,
  annotationModeEnabled,
  hidePersonalBibleData = false,
  isInTab,
  coverage,
  onNavigateToVerse,
  onOpenTextMode,
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

  // Bookmark ref
  const bookmarkModalRef = useRef<SheetRef>(null)
  const exportSheetRef = useRef<SheetRef>(null)
  const bible = useAtomValue(bibleAtom)
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
    planPassage,
  } = bible.data
  const bookNumber = book.Numero
  // The frame of the reading speaks the main version's language
  const readingLanguage = getReadingLanguage(version)
  const bookName = getReadingBookName(book, version)
  const isParallel = parallelVersions.length > 0
  const displayVerses = focusVerses

  // Check if verses are selected
  const hasSelectedVerses =
    !hidePersonalBibleData && selectedVerses && Object.keys(selectedVerses).length > 0
  // Parallel reading: the selection belongs to one version, named after the reference
  const selectedVersesReference = isParallel
    ? `${verseToReference(selectedVerses)} · ${getSelectedVersesVersion(bible.data)}`
    : verseToReference(selectedVerses)

  // Check if current chapter has a bookmark
  const selectBookmarkForChapter = makeSelectBookmarkForChapter()
  const storedCurrentChapterBookmark = useSelector((state: RootState) =>
    selectBookmarkForChapter(state, bookNumber, chapter)
  )
  const currentChapterBookmark = hidePersonalBibleData ? undefined : storedCurrentChapterBookmark

  const hasFocusVerses = focusVerses && focusVerses.length > 0
  const focusedReference = hasFocusVerses
    ? verseToReference(
        { bookNum: bookNumber, chapterNum: chapter, verses: displayVerses },
        { language: readingLanguage }
      )
    : ''
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
        // A tab is a free reader: it does not stay bound to the passage of a plan.
        planPassage: undefined,
      },
    })
  }

  // Parallel reading chooses each version in its own column: the book stands alone
  const bookTriggerClassName = `overflow-hidden border-continuous items-center justify-center pl-[12px] h-[32px] ${
    isParallel ? 'pr-[12px]' : 'pr-[7px]'
  }`
  const bookTriggerContent = (
    <>
      <AnimatedBox
        className={`overflow-hidden border-continuous bg-light-grey absolute left-[0px] bottom-[0px] right-[0px] top-[0px] ${
          isParallel ? 'rounded-[20px]' : 'rounded-tl-[20px] rounded-bl-[20px]'
        }`}
        style={opacityTransitionStyle}
      />
      <AnimatedText className="font-bold text-[14px]" style={translateYTransitionStyle}>
        {isSmall ? truncate(`${bookName} ${chapter}`, 10) : `${bookName} ${chapter}`}
      </AnimatedText>
    </>
  )

  const isVerticalParallelMode = displayMode === 'vertical'
  const nextColumnWidth = columnWidth === 50 ? 75 : columnWidth === 75 ? 100 : 50

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

  // The chapter as the public site shows it; a version the site does not serve has no link.
  const chapterShareUrl = getChapterShareUrl(bookNumber, chapter, version)

  // Parallel display sits in the header, unless a back button leaves no room on a phone
  const hasParallelButton = !planPassage && (isParallel || !(hasBackButton && isSmall))

  const mainMenuActions: MenuAction[] = [
    ...(!hasParallelButton
      ? [
          {
            id: 'parallel',
            title: t('Affichage parallèle'),
            image: 'rectangle.split.2x1' as const,
            state: isParallel ? ('on' as const) : ('off' as const),
          },
        ]
      : []),
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
    ...(chapterShareUrl
      ? [{ id: SHARE_LINK_ACTION, title: t('Partager le lien'), image: 'link' as const }]
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

  // Plan mode keeps the chapter header, bound to its passage: no parallel display.
  const chapterMenuActions = planPassage
    ? getPassagePreviewMenuActions(mainMenuActions)
    : mainMenuActions

  const handleMenuAction = (id: string) => {
    switch (id) {
      case 'parallel':
        if (isParallel) removeAllParallelVersions()
        else addParallelVersion()
        break
      case 'history':
        router.push({ pathname: '/history', params: { filter: 'bible' } })
        break
      case 'bookmark':
        bookmarkModalRef.current?.present()
        break
      case SHARE_LINK_ACTION:
        void shareResourceLink({
          url: chapterShareUrl,
          title: `${verseToReference({ bookNum: bookNumber, chapterNum: chapter, verses: [] })} - ${version}`,
        })
        break
      case 'export':
        exportSheetRef.current?.present()
        break
      case 'open-tab':
        openInBibleTab()
        break
    }
  }

  // One display segment after the version: the interlinear sheet also offers Strong.
  // Parallel reading: each version sets its own modes, from its chip in the reader.
  const textModeKind: BibleTextModeKind | null = isParallel
    ? null
    : isInterlinearCapableBibleVersion(version)
      ? 'interlinear'
      : isStrongCapableBibleVersion(version)
        ? 'strong'
        : null
  const isTextModeActive =
    textModeKind === 'interlinear'
      ? isInterlinearModeEnabled(interlinearMode)
      : strongMode !== 'hidden'

  // After the version in the chip; alone, a whole pill, in focus where the version is a label
  const renderTextModeSegment = (standalone: boolean) =>
    textModeKind ? (
      <DisplayModeTrigger
        kind={textModeKind}
        bibleAtom={bibleAtom}
        className={`overflow-hidden border-continuous items-center justify-center pr-[11px] h-[32px] ${
          standalone ? 'pl-[11px]' : 'pl-[8px]'
        }`}
        onPress={() => onOpenTextMode(textModeKind, 0)}
        accessibilityRole="button"
        accessibilityLabel={
          textModeKind === 'interlinear'
            ? t('Options du texte original')
            : t('Choisir l’affichage de la Bible Strong')
        }
        accessibilityState={{ selected: isTextModeActive }}
      >
        <AnimatedBox
          className={`overflow-hidden border-continuous bg-light-grey rounded-tr-[20px] rounded-br-[20px] absolute left-[0px] bottom-[0px] right-[0px] top-[0px] ${
            standalone ? 'rounded-tl-[20px] rounded-bl-[20px]' : ''
          }`}
          style={opacityTransitionStyle}
        />
        <AnimatedBox style={opacityTransitionStyle}>
          {textModeKind === 'interlinear' ? (
            <InterlinearMark highlighted={isTextModeActive} />
          ) : (
            <StrongMark highlighted={isTextModeActive} />
          )}
        </AnimatedBox>
      </DisplayModeTrigger>
    ) : null

  // The version opens its selector, after the book
  const versionChip = (
    <>
      <BibleSelectorTrigger
        kind="version"
        data={getDefaultStore().get(bibleAtom).data}
        actions={actions}
        className={`overflow-hidden border-continuous items-center justify-center pl-[7px] h-[32px] ${
          textModeKind ? 'pr-[7px]' : 'pr-[12px]'
        }`}
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
          className={`overflow-hidden border-continuous bg-light-grey absolute left-[0px] bottom-[0px] right-[0px] top-[0px] ${
            textModeKind ? '' : 'rounded-tr-[20px] rounded-br-[20px]'
          }`}
          style={opacityTransitionStyle}
        />
        <AnimatedText className="font-bold text-[14px]" style={translateYTransitionStyle}>
          {version}
        </AnimatedText>
      </BibleSelectorTrigger>
      {renderTextModeSegment(false)}
    </>
  )

  const paramsButton = (
    <AnimatedTouchableBox
      className="overflow-hidden border-continuous items-center justify-center w-[36px] h-[40px]"
      onPress={onBibleParamsClick}
      accessibilityRole="button"
      accessibilityLabel={t('Police et paramêtres')}
      style={opacityTransitionStyle}
    >
      <Text className="font-bold text-[16px]">Aa</Text>
    </AnimatedTouchableBox>
  )

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
              {`${verseToReference({ bookNum: bookNumber, chapterNum: chapter, verses: displayVerses }, { language: readingLanguage })} - ${version}`}
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

  // Recreate the native animated frame when leaving focus: reusing it can keep
  // the newly mounted book selector invisible on iOS.
  return (
    <AnimatedVStack
      className="border-continuous overflow-visible justify-center w-[100%] bg-reverse border-b-[1px] border-border absolute top-[0px] left-[0px]"
      style={[
        { paddingTop: TOP_INSET, zIndex: nativeHeaderZIndex },
        {
          height: isHeaderCollapsed ? 20 + TOP_INSET : undefined,
          minHeight: isHeaderCollapsed ? 20 + TOP_INSET : headerHeight + TOP_INSET,
          transitionProperty: 'height',
          transitionDuration: 300,
        },
      ]}
      testID="workspace-page-header"
      key={planPassage ? 'plan-header' : hasFocusVerses ? 'focused-header' : 'chapter-header'}
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
        {hasFocusVerses && !planPassage ? (
          <HStack className="overflow-hidden border-continuous flex-1 items-center">
            <HStack className="overflow-hidden border-continuous flex-1 min-w-0 items-center gap-[10px] pl-[22px]">
              <AnimatedText
                className="font-bold text-[14px]"
                numberOfLines={1}
                style={[{ flexShrink: 1 }, translateYTransitionStyle]}
              >
                {`${focusedReference} - ${version}`}
              </AnimatedText>
              {renderTextModeSegment(true)}
            </HStack>
            {paramsButton}
            <BibleOptionsMenu
              bookNumber={bookNumber}
              chapter={chapter}
              version={version}
              accessibilityLabel={t('accessibility.bibleOptions')}
              actions={getPassagePreviewMenuActions(mainMenuActions)}
              onPressAction={({ nativeEvent }) => handleMenuAction(nativeEvent.event)}
            >
              <AnimatedBox
                className="overflow-hidden border-continuous items-center justify-center w-[36px] h-[40px]"
                style={opacityTransitionStyle}
              >
                <FeatherIcon name="more-vertical" size={18} />
              </AnimatedBox>
            </BibleOptionsMenu>
          </HStack>
        ) : (
          <>
            <HStack className="overflow-hidden border-continuous items-center gap-[3px] pl-[10px]">
              <HStack className="overflow-hidden border-continuous">
                {planPassage ? (
                  // The plan bounds the reading, so the passage reads as a label, not a selector.
                  <Box
                    className={bookTriggerClassName}
                    accessibilityLabel={`${bookName} ${chapter}`}
                  >
                    {bookTriggerContent}
                  </Box>
                ) : (
                  <BibleSelectorTrigger
                    kind="book"
                    data={getDefaultStore().get(bibleAtom).data}
                    actions={actions}
                    coverage={coverage}
                    className={bookTriggerClassName}
                    onPress={() => {
                      openBookSelector({
                        actions,
                        data: getDefaultStore().get(bibleAtom).data,
                      })
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('accessibility.chooseBookAndChapter', {
                      reference: `${bookName} ${chapter}`,
                    })}
                  >
                    {bookTriggerContent}
                  </BibleSelectorTrigger>
                )}
              </HStack>
              {!isParallel && versionChip}
            </HStack>

            <VerseSelectorPopup bibleAtom={bibleAtom} coverage={coverage} preferCoverage>
              <AnimatedBox
                className="overflow-hidden border-continuous items-center justify-center w-[32px] h-[100%]"
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
                      className="overflow-hidden border-continuous items-center justify-center w-[36px] h-[40px]"
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
                {!isParallel && hasParallelButton && (
                  <AnimatedTouchableBox
                    className="overflow-hidden border-continuous items-center justify-center w-[36px] h-[40px]"
                    onPress={addParallelVersion}
                    accessibilityRole="button"
                    accessibilityLabel={t('Affichage parallèle')}
                    style={opacityTransitionStyle}
                  >
                    <ParallelIcon color="default" />
                  </AnimatedTouchableBox>
                )}

                {paramsButton}

                {/* Three-dots menu */}
                <BibleOptionsMenu
                  bookNumber={bookNumber}
                  chapter={chapter}
                  version={version}
                  accessibilityLabel={t('accessibility.bibleOptions')}
                  actions={chapterMenuActions}
                  onPressAction={({ nativeEvent }) => handleMenuAction(nativeEvent.event)}
                >
                  <AnimatedBox
                    className="overflow-hidden border-continuous items-center justify-center w-[36px] h-[40px]"
                    style={{
                      opacity: fullScreenOpacity,
                      transitionProperty: 'opacity',
                      transitionDuration: 300,
                    }}
                  >
                    <FeatherIcon name="more-vertical" size={18} />
                  </AnimatedBox>
                </BibleOptionsMenu>
                {hasFocusVerses && !planPassage && (
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
      <BibleVerseKeyboardDialog
        bibleAtom={bibleAtom}
        coverage={coverage}
        onNavigate={onNavigateToVerse}
      />
      <PassageExportSheet
        ref={exportSheetRef}
        sourceType="chapter"
        bookNumber={bookNumber}
        chapterNumber={chapter}
        version={version}
      />
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
