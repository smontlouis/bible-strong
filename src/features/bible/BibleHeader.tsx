import { useEffect, useMemo, useRef } from 'react'

import { useRouter } from 'expo-router'
import { VerseIds } from '~common/types'
import verseToReference from '~helpers/verseToReference'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useDerivedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { isFullScreenBibleValue } from 'src/state/app'
import Back from '~common/Back'
import ParallelIcon from '~common/ParallelIcon'
import PopOverMenu from '~common/PopOverMenu'
import { toast } from 'sonner-native'
import Box, {
  HStack,
  MotiBox,
  MotiHStack,
  MotiText,
  motiTransition,
  TouchableBox,
} from '~common/ui/Box'
import { FeatherIcon, IonIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import { getIfDatabaseNeedsDownload } from '~helpers/databases'
import truncate from '~helpers/truncate'
import useDimensions from '~helpers/useDimensions'
import useLanguage from '~helpers/useLanguage'
import { usePrevious } from '~helpers/usePrevious'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { makeSelectBookmarkForChapter } from '~redux/selectors/bookmarks'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import BookmarkModal from '~features/bookmarks/BookmarkModal'
import { useBookAndVersionSelector } from './BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import { VerseSelectorPopup } from './VerseSelectorPopup'

interface BibleHeaderProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  hasBackButton?: boolean
  onBibleParamsClick: () => void
  commentsDisplay?: boolean
  version: string
  bookName: string
  chapter: number
  verseFormatted: string
  isSelectionMode?: boolean
  isParallel?: boolean
  selectedVerses?: VerseIds
  isReadOnly?: boolean
}

const Header = ({
  hasBackButton,
  bibleAtom,
  onBibleParamsClick,
  commentsDisplay,
  version,
  bookName,
  chapter,
  verseFormatted,
  isSelectionMode,
  isParallel,
  selectedVerses,
  isReadOnly,
}: BibleHeaderProps) => {
  const router = useRouter()
  const { t } = useTranslation()
  const isFR = useLanguage()
  const dispatch = useDispatch()
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400
  const actions = useBibleTabActions(bibleAtom)
  const insets = useSafeAreaInsets()
  const { openBookSelector, openVersionSelector } = useBookAndVersionSelector()

  // Bookmark ref
  const bookmarkModalRef = useRef<BottomSheetModal>(null)
  const bible = useAtomValue(bibleAtom)
  const bookNumber = bible.data.selectedBook.Numero

  // Check if verses are selected
  const hasSelectedVerses = selectedVerses && Object.keys(selectedVerses).length > 0
  const selectedVersesReference = hasSelectedVerses ? verseToReference(selectedVerses) : ''

  // Check if current chapter has a bookmark
  const selectBookmarkForChapter = useMemo(() => makeSelectBookmarkForChapter(), [])
  const currentChapterBookmark = useSelector((state: RootState) =>
    selectBookmarkForChapter(state, bookNumber, chapter)
  )

  // Track previous book and chapter to avoid overwriting custom titles
  const prevBook = usePrevious(bookName)
  const prevChapter = usePrevious(chapter)

  useEffect(() => {
    // Only update title if book or chapter changed (not on first mount)
    // prevBook is undefined on first render, so we skip the update
    if (prevBook !== undefined && (prevBook !== bookName || prevChapter !== chapter)) {
      actions.setTitle(`${t(bookName)} ${chapter} - ${version}`)
    }
  }, [actions, bookName, chapter, version, t, prevBook, prevChapter])

  const { addParallelVersion, removeAllParallelVersions } = actions

  // useDerivedValue hooks must be at the top level
  const headerHeight = useDerivedValue(() => {
    return {
      height: isFullScreenBibleValue.get() ? 20 + insets.top : HEADER_HEIGHT + insets.top,
    }
  })

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

  return (
    <MotiHStack
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
      // zIndex={1}
      // @ts-ignore
      animate={headerHeight}
      overflow="visible"
      {...motiTransition}
    >
      <HStack maxWidth={830} mx="auto" alignItems="center" width="100%">
        {(isSelectionMode || hasBackButton) && (
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
              // @ts-ignore
              animate={backButtonTranslateY}
              {...motiTransition}
            >
              <FeatherIcon name="arrow-left" size={20} />
            </MotiBox>
          </Back>
        )}
        {hasSelectedVerses ? (
          <Box flex={1} center>
            <Text fontWeight="bold" fontSize={14}>
              {selectedVersesReference}
            </Text>
          </Box>
        ) : isReadOnly ? (
          <Box flex={1} center>
            <Text fontWeight="bold" fontSize={14}>
              {`${t(bookName)} ${chapter}:${verseFormatted} - ${version}`}
            </Text>
          </Box>
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
                    {isSmall ? truncate(`${t(bookName)} ${chapter}`, 10) : `${t(bookName)} ${chapter}`}
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
                      {!commentsDisplay && isFR && (
                        <MenuOption onSelect={onOpenCommentaire}>
                          <Box row alignItems="center">
                            <MaterialIcon name="chat" size={20} />
                            <Text marginLeft={10}>{t('Commentaire désactivé')}</Text>
                          </Box>
                        </MenuOption>
                      )}
                      {commentsDisplay && isFR && (
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
                            color={currentChapterBookmark ? currentChapterBookmark.color : undefined}
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
    </MotiHStack>
  )
}

export default Header
