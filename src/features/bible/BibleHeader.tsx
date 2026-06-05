import { useEffect, useRef } from 'react'

import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { type SheetRef } from '~common/sheet'
import { useRouter } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { isFullScreenBibleAtom } from 'src/state/app'
import {
  parallelColumnWidthAtom,
  parallelDisplayModeAtom,
  BibleTab,
  getBibleContextDisplayMode,
  useBibleTabActions,
} from 'src/state/tabs'
import Back from '~common/Back'
import ParallelIcon from '~common/ParallelIcon'
import Box, {
  AnimatedBox,
  AnimatedHStack,
  AnimatedTouchableBox,
  HStack,
  TouchableBox,
} from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text, { AnimatedText } from '~common/ui/Text'
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
} from '~features/app-switcher/utils/constants'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import BookmarkModal from '~features/bookmarks/BookmarkModal'
import { getIfDatabaseNeedsDownload } from '~helpers/databases'
import generateUUID from '~helpers/generateUUID'
import { toast } from '~helpers/toast'
import truncate from '~helpers/truncate'
import useDimensions from '~helpers/useDimensions'
import useLanguage from '~helpers/useLanguage'
import verseToReference from '~helpers/verseToReference'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { makeSelectBookmarkForChapter } from '~redux/selectors/bookmarks'
import { useBookAndVersionSelector } from './BookSelectorSheet/BookSelectorSheetProvider'
import { VerseSelectorPopup } from './VerseSelectorPopup'

interface BibleHeaderProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  isFormSheet?: boolean
  onBibleParamsClick: () => void
  commentsDisplay?: boolean
  onExitAnnotationMode?: () => void
  annotationModeEnabled?: boolean
}

const Header = ({
  isFormSheet,
  bibleAtom,
  onBibleParamsClick,
  commentsDisplay,
  onExitAnnotationMode,
  annotationModeEnabled,
}: BibleHeaderProps) => {
  const router = useRouter()
  const { t } = useTranslation()
  const lang = useLanguage()
  const dispatch = useDispatch()
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
  const hasBackButton = Boolean(isFormSheet && canGoBackInStack)
  const openInNewTab = useOpenInNewTab()

  // Bookmark ref
  const bookmarkModalRef = useRef<SheetRef>(null)
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
  } = bible.data
  const bookNumber = book.Numero
  const bookName = book.Nom
  const isParallel = parallelVersions.length > 0
  const displayVerses = focusVerses

  // Check if verses are selected
  const hasSelectedVerses = selectedVerses && Object.keys(selectedVerses).length > 0
  const selectedVersesReference = verseToReference(selectedVerses)

  // Check if current chapter has a bookmark
  const selectBookmarkForChapter = makeSelectBookmarkForChapter()
  const currentChapterBookmark = useSelector((state: RootState) =>
    selectBookmarkForChapter(state, bookNumber, chapter)
  )

  const hasFocusVerses = focusVerses && focusVerses.length > 0

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

  const translateYTransitionStyle = {
    transform: [{ translateY: fullScreenTranslateY }],
    transitionProperty: 'transform',
    transitionDuration: 300,
  } as const

  const onOpenCommentaire = async () => {
    const needsDownload = await getIfDatabaseNeedsDownload('MHY')

    if (needsDownload) {
      toast(t('Téléchargez la base de commentaires Matthew Henry'))
      router.push('/downloads')
      return
    }

    dispatch(setSettingsCommentaires(true))
  }

  const openInBibleTab = () => {
    openInNewTab({
      ...bible,
      id: `bible-${generateUUID()}`,
      data: {
        ...bible.data,
      },
    })
  }

  const isVerticalParallelMode = displayMode === 'vertical'
  const nextColumnWidth = columnWidth === 50 ? 75 : columnWidth === 75 ? 100 : 50

  const focusMenuActions: MenuAction[] = [
    {
      id: 'toggle-context',
      title: isContextFocused ? t('tab.readWholeChapter') : t('tab.closeContext'),
      image: isContextFocused
        ? 'arrow.up.left.and.arrow.down.right'
        : 'arrow.down.right.and.arrow.up.left',
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
    ...(!commentsDisplay && lang === 'fr'
      ? [
          {
            id: 'comments-on',
            title: t('Commentaire désactivé'),
            image: 'bubble.left.and.bubble.right' as const,
          },
        ]
      : []),
    ...(commentsDisplay && lang === 'fr'
      ? [
          {
            id: 'comments-off',
            title: t('Commentaire activé'),
            image: 'bubble.left.and.bubble.right' as const,
            state: 'on' as const,
          },
        ]
      : []),
    {
      id: 'parallel',
      title: t('Affichage parallèle'),
      image: 'rectangle.split.2x1',
      state: isParallel ? 'on' : 'off',
    },
    { id: 'history', title: t('Historique'), image: 'clock.arrow.circlepath' },
    {
      id: 'bookmark',
      title: currentChapterBookmark ? t('Modifier le marque-page') : t('Ajouter un marque-page'),
      image: 'bookmark',
    },
    {
      id: 'open-tab',
      title: t('tab.openInNewTab'),
      image: 'arrow.up.forward.square',
    },
  ]

  if (annotationModeEnabled) {
    return (
      <AnimatedHStack
        width="100%"
        bg="primary"
        px={15}
        paddingTop={TOP_INSET}
        height={headerHeight + TOP_INSET}
        borderBottomWidth={1}
        borderColor="border"
        position="absolute"
        top={0}
        left={0}
        overflow="visible"
        entering={FadeIn}
        exiting={FadeOut}
        key="annotation-mode-header"
      >
        <HStack maxWidth={830} mx="auto" alignItems="center" width="100%">
          {hasBackButton && (
            <Box position="absolute" left={0} top={5} zIndex={2}>
              <Back
                onGoBack={() => {
                  setIsFullScreenBible(false)
                  console.log('[Bible] onGoBack')
                }}
              >
                <Box alignItems="center" justifyContent="center" width={50} height={32}>
                  <FeatherIcon name="arrow-left" size={20} color="white" />
                </Box>
              </Back>
            </Box>
          )}
          <Box flex={1} center>
            <Text fontWeight="bold" color="reverse" fontSize={14}>
              {`${verseToReference({ bookNum: bookNumber, chapterNum: chapter, verses: displayVerses })} - ${version}`}
            </Text>
          </Box>

          <AnimatedTouchableBox
            onPress={onExitAnnotationMode}
            position="absolute"
            right={0}
            bottom={10}
          >
            <Box bg="reverse" borderRadius={8} height={28} px={12} center>
              <Text color="primary" bold fontSize={12}>
                {t('Terminé')}
              </Text>
            </Box>
          </AnimatedTouchableBox>
        </HStack>
      </AnimatedHStack>
    )
  }

  if (hasSelectedVerses) {
    return (
      <AnimatedHStack
        width="100%"
        bg="reverse"
        px={15}
        paddingTop={TOP_INSET}
        height={headerHeight + TOP_INSET}
        borderBottomWidth={1}
        borderColor="border"
        position="absolute"
        top={0}
        left={0}
        overflow="visible"
        entering={FadeIn}
        exiting={FadeOut}
        key="selected-verses-header"
      >
        <HStack maxWidth={830} mx="auto" alignItems="center" width="100%">
          {hasBackButton && (
            <Back
              onGoBack={() => {
                setIsFullScreenBible(false)
                console.log('[Bible] onGoBack')
              }}
            >
              <Box alignItems="center" justifyContent="center" width={50} height={32}>
                <FeatherIcon name="arrow-left" size={20} />
              </Box>
            </Back>
          )}
          <Box flex={1} center>
            <Text fontWeight="bold" fontSize={14}>
              {selectedVersesReference}
            </Text>
          </Box>
        </HStack>
      </AnimatedHStack>
    )
  }

  return (
    <AnimatedHStack
      width="100%"
      bg="reverse"
      paddingTop={TOP_INSET}
      borderBottomWidth={1}
      borderColor="border"
      position="absolute"
      top={0}
      left={0}
      overflow="visible"
      style={{
        height: isHeaderCollapsed ? 20 + TOP_INSET : headerHeight + TOP_INSET,
        transitionProperty: 'height',
        transitionDuration: 300,
      }}
      key="default-header"
      entering={FadeIn}
      exiting={FadeOut}
    >
      <HStack maxWidth={830} mx="auto" alignItems="center" width="100%">
        {hasBackButton ? (
          <Back
            onGoBack={() => {
              setIsFullScreenBible(false)
              console.log('[Bible] onGoBack')
            }}
          >
            <AnimatedBox
              alignItems="center"
              justifyContent="center"
              width={50}
              height={32}
              style={translateYTransitionStyle}
            >
              <FeatherIcon name="arrow-left" size={20} />
            </AnimatedBox>
          </Back>
        ) : null}
        {hasFocusVerses ? (
          <>
            <AnimatedBox flex={1} style={translateYTransitionStyle}>
              <HStack px={15} alignItems="center" justifyContent="space-between" gap={8}>
                <Text fontWeight="bold" fontSize={14}>
                  {`${verseToReference({ bookNum: bookNumber, chapterNum: chapter, verses: displayVerses })} - ${version}`}
                </Text>
                <MenuView
                  actions={focusMenuActions}
                  onPressAction={({ nativeEvent }) => {
                    switch (nativeEvent.event) {
                      case 'toggle-context':
                        if (isContextFocused) actions.expandContext()
                        else actions.collapseContext()
                        break
                      case 'open-tab':
                        openInBibleTab()
                        break
                      case 'clear-focus':
                        actions.clearFocusVerses()
                        break
                    }
                  }}
                >
                  <AnimatedBox style={opacityTransitionStyle}>
                    <Box bg="lightPrimary" px={8} py={3} borderRadius={12}>
                      <HStack alignItems="center" gap={3}>
                        <Text color="primary" fontSize={11} fontWeight="bold">
                          Focus
                        </Text>
                        <FeatherIcon name="chevron-down" size={12} color="primary" />
                      </HStack>
                    </Box>
                  </AnimatedBox>
                </MenuView>
              </HStack>
            </AnimatedBox>
          </>
        ) : (
          <>
            <HStack alignItems="center" gap={3} pl={10}>
              <HStack>
                <TouchableBox
                  onPress={() => {
                    openBookSelector({
                      actions,
                      data: getDefaultStore().get(bibleAtom).data,
                    })
                  }}
                  center
                  pl={12}
                  pr={7}
                  height={32}
                >
                  <AnimatedBox
                    bg="lightGrey"
                    borderTopLeftRadius={20}
                    borderBottomLeftRadius={20}
                    position="absolute"
                    left={0}
                    bottom={0}
                    right={0}
                    top={0}
                    style={opacityTransitionStyle}
                  />
                  <AnimatedText fontWeight="bold" fontSize={14} style={translateYTransitionStyle}>
                    {isSmall
                      ? truncate(`${t(bookName)} ${chapter}`, 10)
                      : `${t(bookName)} ${chapter}`}
                  </AnimatedText>
                </TouchableBox>
              </HStack>
              <TouchableBox
                onPress={() =>
                  openVersionSelector({
                    actions,
                    data: getDefaultStore().get(bibleAtom).data,
                  })
                }
                center
                pl={7}
                pr={12}
                height={32}
              >
                <AnimatedBox
                  bg="lightGrey"
                  borderTopRightRadius={20}
                  borderBottomRightRadius={20}
                  position="absolute"
                  left={0}
                  bottom={0}
                  right={0}
                  top={0}
                  style={opacityTransitionStyle}
                />
                <AnimatedText fontWeight="bold" fontSize={14} style={translateYTransitionStyle}>
                  {version}
                </AnimatedText>
              </TouchableBox>
            </HStack>

            <VerseSelectorPopup bibleAtom={bibleAtom}>
              <AnimatedBox center width={40} height="100%" style={opacityTransitionStyle}>
                <FeatherIcon name="chevrons-down" size={20} style={{ opacity: 0.3 }} />
              </AnimatedBox>
            </VerseSelectorPopup>
            {!isSelectionMode && (
              <HStack marginLeft="auto">
                {isParallel && (
                  <MenuView
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
                      center
                      width={40}
                      height="100%"
                      style={{
                        opacity: fullScreenOpacity,
                        transitionProperty: 'opacity',
                        transitionDuration: 300,
                      }}
                    >
                      <Box position="relative" overflow="visible">
                        <ParallelIcon color="primary" />
                        <Box
                          position="absolute"
                          bottom={-2}
                          right={-4}
                          bg="grey"
                          borderRadius={99}
                          width={12}
                          height={12}
                          center
                        >
                          <Text fontSize={9} color="reverse" fontWeight="bold">
                            {parallelVersions.length + 1}
                          </Text>
                        </Box>
                      </Box>
                    </AnimatedBox>
                  </MenuView>
                )}

                {/* Three-dots menu */}
                <MenuView
                  actions={mainMenuActions}
                  onPressAction={({ nativeEvent }) => {
                    switch (nativeEvent.event) {
                      case 'params':
                        onBibleParamsClick()
                        break
                      case 'comments-on':
                        onOpenCommentaire()
                        break
                      case 'comments-off':
                        dispatch(setSettingsCommentaires(false))
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
                      case 'open-tab':
                        openInBibleTab()
                        break
                    }
                  }}
                >
                  <AnimatedBox
                    center
                    width={40}
                    height="100%"
                    style={{
                      opacity: fullScreenOpacity,
                      transitionProperty: 'opacity',
                      transitionDuration: 300,
                    }}
                  >
                    <FeatherIcon name="more-vertical" size={18} />
                  </AnimatedBox>
                </MenuView>
                {focusVerses && focusVerses.length > 0 && (
                  <TouchableBox
                    onPress={() => actions.clearFocusVerses()}
                    center
                    width={40}
                    height={32}
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
      {currentChapterBookmark && (
        <Box position="absolute" right={24} bottom={-18}>
          <TouchableBox center height="100%" onPress={() => bookmarkModalRef.current?.present()}>
            <IonIcon name="bookmark" size={24} color={currentChapterBookmark.color} />
          </TouchableBox>
        </Box>
      )}
    </AnimatedHStack>
  )
}

export default Header
