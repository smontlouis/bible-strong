import { useEffect, useRef } from 'react'

import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { FadeIn, FadeOut, useDerivedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { isFullScreenBibleAtom, isFullScreenBibleValue } from 'src/state/app'
import { parallelColumnWidthAtom, parallelDisplayModeAtom } from 'src/state/tabs'
import Back from '~common/Back'
import ParallelIcon from '~common/ParallelIcon'
import PopOverMenu from '~common/PopOverMenu'
import Box, {
  AnimatedHStack,
  HStack,
  MotiBox,
  MotiText,
  motiTransition,
  TouchableBox,
} from '~common/ui/Box'
import { FeatherIcon, IonIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import BookmarkModal from '~features/bookmarks/BookmarkModal'
import { getIfDatabaseNeedsDownload } from '~helpers/databases'
import { toast } from '~helpers/toast'
import truncate from '~helpers/truncate'
import useDimensions from '~helpers/useDimensions'
import useLanguage from '~helpers/useLanguage'
import { usePrevious } from '~helpers/usePrevious'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { makeSelectBookmarkForChapter } from '~redux/selectors/bookmarks'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import { useBookAndVersionSelector } from './BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import ParallelVersionsPopover from './ParallelVersionsPopover'
import { VerseSelectorPopup } from './VerseSelectorPopup'

interface BibleHeaderProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  hasBackButton?: boolean
  onBibleParamsClick: () => void
  commentsDisplay?: boolean
  onExitAnnotationMode?: () => void
  annotationModeEnabled?: boolean
}

const Header = ({
  hasBackButton,
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
  const columnWidth = useAtomValue(parallelColumnWidthAtom)
  const setColumnWidth = useSetAtom(parallelColumnWidthAtom)
  const displayMode = useAtomValue(parallelDisplayModeAtom)
  const setDisplayMode = useSetAtom(parallelDisplayModeAtom)

  // Bookmark ref
  const bookmarkModalRef = useRef<BottomSheetModal>(null)
  const bible = useAtomValue(bibleAtom)
  const {
    selectedBook: book,
    selectedChapter: chapter,
    selectedVersion: version,
    selectedVerses,
    isReadOnly,
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

  const backButtonTranslateY = useDerivedValue(() => {
    return {
      translateY: isFullScreenBibleValue.get() ? -2 : 0,
    }
  })

  const bookSelectorOpacity = useDerivedValue(() => {
    return {
      opacity: isFullScreenBibleValue.get() ? 0 : 1,
    }
  })

  const bookSelectorTranslateY = useDerivedValue(() => {
    return {
      translateY: isFullScreenBibleValue.get() ? -2 : 0,
    }
  })

  const versionSelectorOpacity = useDerivedValue(() => {
    return {
      opacity: isFullScreenBibleValue.get() ? 0 : 1,
    }
  })

  const versionSelectorTranslateY = useDerivedValue(() => {
    return {
      translateY: isFullScreenBibleValue.get() ? -2 : 0,
    }
  })

  const verseSelectorOpacity = useDerivedValue(() => {
    return {
      opacity: isFullScreenBibleValue.get() ? 0 : 1,
    }
  })

  const menuOpacity = useDerivedValue(() => {
    return {
      opacity: isFullScreenBibleValue.get() ? 0 : 1,
    }
  })

  const onOpenCommentaire = async () => {
    const needsDownload = await getIfDatabaseNeedsDownload('MHY')

    if (needsDownload) {
      toast(t('Téléchargez la base de commentaires Matthew Henry'))
      router.push('/downloads')
      return
    }

    dispatch(setSettingsCommentaires(true))
  }

  if (annotationModeEnabled) {
    return (
      <AnimatedHStack
        width="100%"
        bg="primary"
        px={15}
        paddingTop={insets.top}
        height={HEADER_HEIGHT + insets.top}
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
                  isFullScreenBibleValue.set(false)
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

          <TouchableBox onPress={onExitAnnotationMode} position="absolute" right={0} bottom={10}>
            <Box bg="reverse" borderRadius={8} height={28} px={12} center>
              <Text color="primary" bold fontSize={12}>
                {t('Terminé')}
              </Text>
            </Box>
          </TouchableBox>
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
        paddingTop={insets.top}
        height={HEADER_HEIGHT + insets.top}
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
                isFullScreenBibleValue.set(false)
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
      px={15}
      paddingTop={insets.top}
      borderBottomWidth={1}
      borderColor="border"
      position="absolute"
      top={0}
      left={0}
      overflow="visible"
      style={{
        height: isFullScreenBible ? 20 + insets.top : HEADER_HEIGHT + insets.top,
        transitionProperty: 'height',
        transitionDuration: 300,
      }}
      key="default-header"
      entering={FadeIn}
      exiting={FadeOut}
    >
      <HStack maxWidth={830} mx="auto" alignItems="center" width="100%">
        {hasBackButton && (
          <Back
            onGoBack={() => {
              isFullScreenBibleValue.set(false)
              console.log('[Bible] onGoBack')
            }}
          >
            <MotiBox
              alignItems="center"
              justifyContent="center"
              width={50}
              height={32}
              animate={backButtonTranslateY}
              {...motiTransition}
            >
              <FeatherIcon name="arrow-left" size={20} />
            </MotiBox>
          </Back>
        )}
        {isReadOnly ? (
          <>
            <Box flex={1} center>
              <Text fontWeight="bold" fontSize={14}>
                {`${verseToReference({ bookNum: bookNumber, chapterNum: chapter, verses: displayVerses })} - ${version}`}
              </Text>
            </Box>
            <Box width={50} />
          </>
        ) : (
          <>
            <HStack alignItems="center" gap={3}>
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
                  <MotiBox
                    bg="lightGrey"
                    borderTopLeftRadius={20}
                    borderBottomLeftRadius={20}
                    position="absolute"
                    left={0}
                    bottom={0}
                    right={0}
                    top={0}
                    // @ts-ignore
                    animate={bookSelectorOpacity}
                  />
                  <MotiText
                    fontWeight="bold"
                    fontSize={14}
                    // @ts-ignore
                    animate={bookSelectorTranslateY}
                    {...motiTransition}
                  >
                    {isSmall
                      ? truncate(`${t(bookName)} ${chapter}`, 10)
                      : `${t(bookName)} ${chapter}`}
                  </MotiText>
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
                <MotiBox
                  bg="lightGrey"
                  borderTopRightRadius={20}
                  borderBottomRightRadius={20}
                  position="absolute"
                  left={0}
                  bottom={0}
                  right={0}
                  top={0}
                  // @ts-ignore
                  animate={versionSelectorOpacity}
                />
                <MotiText
                  fontWeight="bold"
                  fontSize={14}
                  // @ts-ignore
                  animate={versionSelectorTranslateY}
                  {...motiTransition}
                >
                  {version}
                </MotiText>
              </TouchableBox>
            </HStack>

            <PopOverMenu
              element={
                <MotiBox
                  center
                  width={40}
                  height="100%"
                  // @ts-ignore
                  animate={verseSelectorOpacity}
                >
                  <FeatherIcon name="chevrons-down" size={20} style={{ opacity: 0.3 }} />
                </MotiBox>
              }
              popover={<VerseSelectorPopup bibleAtom={bibleAtom} />}
            />
            {!isSelectionMode && (
              <HStack marginLeft="auto">
                {isParallel && (
                  <PopOverMenu
                    element={
                      <MotiBox
                        center
                        width={40}
                        height="100%"
                        // @ts-ignore
                        animate={menuOpacity}
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
                      </MotiBox>
                    }
                    popover={
                      <ParallelVersionsPopover
                        version={version}
                        parallelVersions={parallelVersions}
                        addParallelVersion={addParallelVersion}
                        removeParallelVersion={removeParallelVersion}
                        removeAllParallelVersions={removeAllParallelVersions}
                        columnWidth={columnWidth}
                        setColumnWidth={setColumnWidth}
                        displayMode={displayMode}
                        setDisplayMode={setDisplayMode}
                      />
                    }
                  />
                )}

                {/* Three-dots menu */}
                <PopOverMenu
                  element={
                    <MotiBox
                      center
                      width={40}
                      height="100%"
                      // @ts-ignore
                      animate={menuOpacity}
                    >
                      <FeatherIcon name="more-vertical" size={18} />
                    </MotiBox>
                  }
                  popover={
                    <>
                      <MenuOption onSelect={onBibleParamsClick}>
                        <Box row alignItems="center">
                          <TextIcon style={{ marginRight: 0 }}>Aa</TextIcon>
                          <Text marginLeft={10}>{t('Police et paramêtres')}</Text>
                        </Box>
                      </MenuOption>
                      {!commentsDisplay && lang === 'fr' && (
                        <MenuOption onSelect={onOpenCommentaire}>
                          <Box row alignItems="center">
                            <MaterialIcon name="chat" size={20} />
                            <Text marginLeft={10}>{t('Commentaire désactivé')}</Text>
                          </Box>
                        </MenuOption>
                      )}
                      {commentsDisplay && lang === 'fr' && (
                        <MenuOption onSelect={() => dispatch(setSettingsCommentaires(false))}>
                          <Box row alignItems="center">
                            <MaterialIcon name="chat" size={20} color="primary" />
                            <Text marginLeft={10}>{t('Commentaire activé')}</Text>
                          </Box>
                        </MenuOption>
                      )}
                      <MenuOption
                        onSelect={isParallel ? removeAllParallelVersions : addParallelVersion}
                      >
                        <Box row alignItems="center">
                          <ParallelIcon color={isParallel ? 'primary' : 'default'} />
                          <Text marginLeft={10}>{t('Affichage parallèle')}</Text>
                        </Box>
                      </MenuOption>
                      <MenuOption onSelect={() => router.push('/history')}>
                        <Box row alignItems="center">
                          <MaterialIcon name="history" size={20} />
                          <Text marginLeft={10}>{t('Historique')}</Text>
                        </Box>
                      </MenuOption>
                      <MenuOption onSelect={() => bookmarkModalRef.current?.present()}>
                        <Box row alignItems="center">
                          <IonIcon
                            name="bookmark"
                            size={20}
                            color={
                              currentChapterBookmark ? currentChapterBookmark.color : undefined
                            }
                          />
                          <Text marginLeft={10}>
                            {currentChapterBookmark
                              ? t('Modifier le marque-page')
                              : t('Ajouter un marque-page')}
                          </Text>
                        </Box>
                      </MenuOption>
                    </>
                  }
                />
              </HStack>
            )}
          </>
        )}
      </HStack>
      <BookmarkModal
        bottomSheetRef={bookmarkModalRef}
        book={bookNumber}
        chapter={chapter}
        version={version}
        existingBookmark={currentChapterBookmark || undefined}
      />
      {currentChapterBookmark && (
        <MotiBox position="absolute" right={24} bottom={-18}>
          <TouchableBox center height="100%" onPress={() => bookmarkModalRef.current?.present()}>
            <IonIcon name="bookmark" size={24} color={currentChapterBookmark.color} />
          </TouchableBox>
        </MotiBox>
      )}
    </AnimatedHStack>
  )
}

export default Header
