import { useTheme } from '@emotion/react'
import type { Feather } from '@expo/vector-icons'
import type { BottomSheetFooterProps } from '@gorhom/bottom-sheet'
import BottomSheet, { BottomSheetFooter, BottomSheetView } from '@gorhom/bottom-sheet'
import Clipboard from '@react-native-clipboard/clipboard'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Share, useWindowDimensions } from 'react-native'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { isFullScreenBibleAtom } from 'src/state/app'
import type { BibleResource, StudyNavigateBibleType, VerseIds } from '~common/types'
import Box, { AnimatedBox, HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useShareOptions } from '~features/settings/BibleShareOptionsScreen'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import { onAnimateModalClose, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { BOTTOM_INSET } from '~helpers/constants'
import getVersesContent from '~helpers/getVersesContent'
import { cleanParams } from '~helpers/utils'
import verseToReference from '../../helpers/verseToReference'
import type { VersionCode } from '../../state/tabs'
import {
  makeLinksByChapterSelector,
  makeNotesForVerseSelector,
  makeHasTaggedItemsForVerseSelector,
} from '~redux/selectors/bible'
import { makeSelectBookmarkForVerse } from '~redux/selectors/bookmarks'
import ColorCirclesBar from './ColorCirclesBar'
import TouchableIcon from './TouchableIcon'

type FeatherIconName = React.ComponentProps<typeof Feather>['name']

type TabType = 'annotate' | 'study' | 'share'
const TABS: TabType[] = ['annotate', 'study', 'share']

interface TabButtonProps {
  label: string
  isActive: boolean
  onPress: () => void
}

const TabButton = ({ label, isActive, onPress }: TabButtonProps) => (
  <Pressable onPress={onPress} style={{ flex: 1, zIndex: 1 }}>
    <Box py={10}>
      <Animated.Text
        style={{
          fontSize: 14,
          fontWeight: isActive ? '600' : '400',
          textAlign: 'center',
          // @ts-ignore - CSS Transitions for Reanimated 4
          transitionProperty: 'color',
          transitionDuration: 150,
        }}
      >
        {label}
      </Animated.Text>
    </Box>
  </Pressable>
)

interface ActionItemProps {
  name?: FeatherIconName
  Icon?: React.FC<{ size?: number }>
  svgSource?: number
  tintColor?: string
  label: string
  onPress: () => void
  disabled?: boolean
  isActive?: boolean
}

const ActionItem = ({
  name,
  Icon,
  svgSource,
  tintColor,
  label,
  onPress,
  disabled,
  isActive,
}: ActionItemProps) => {
  const theme = useTheme()
  const [isPressed, setIsPressed] = useState(false)
  const iconColor = tintColor || theme.colors.primary

  const ACTION_ITEM_WIDTH = 70
  const ICON_BOX_SIZE = 48
  const ICON_SIZE = 20

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={disabled}
      style={{ alignItems: 'center', paddingVertical: 8, width: ACTION_ITEM_WIDTH, gap: 8 }}
    >
      <Animated.View
        style={{
          opacity: disabled ? 0.4 : 1,
          transitionProperty: 'opacity',
          transitionDuration: 100,
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Animated.View
          style={{
            width: ICON_BOX_SIZE,
            height: ICON_BOX_SIZE,
            borderRadius: 16,
            backgroundColor: theme.colors.lightPrimary,
            alignItems: 'center',
            justifyContent: 'center',
            transitionProperty: ['backgroundColor', 'boxShadow'],
            transitionDuration: 100,
            ...(isActive && {
              boxShadow: `inset 0 0 0 2px ${theme.colors.primary}`,
            }),
          }}
        >
          {Icon ? (
            <Icon size={ICON_SIZE} />
          ) : svgSource ? (
            <Image
              source={svgSource}
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
              tintColor={iconColor}
              contentFit="contain"
            />
          ) : name ? (
            <FeatherIcon name={name} size={ICON_SIZE} color={iconColor} />
          ) : null}
        </Animated.View>
        <Text fontSize={10} numberOfLines={1} textAlign="center" color="default">
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

type Props = {
  ref?: React.RefObject<BottomSheet | null>
  isSelectionMode: StudyNavigateBibleType | undefined
  selectedVerseHighlightColor: string | null
  onChangeResourceType: (type: BibleResource) => void
  onCreateNoteClick: () => void
  onCreateLinkClick: () => void
  addHighlight: (color: string) => void
  addTag: () => void
  removeHighlight: () => void
  clearSelectedVerses: () => void
  selectedVerses: VerseIds
  selectAllVerses: () => void
  version: VersionCode
  onAddToStudy: () => void
  onAddBookmark: () => void
  onPinVerses: () => void
  onEnterAnnotationMode?: () => void
  focusVerses?: (string | number)[]
}

const VersesModal = ({
  ref,
  isSelectionMode,
  selectedVerseHighlightColor,
  onChangeResourceType,
  onCreateNoteClick,
  onCreateLinkClick,
  addHighlight,
  addTag,
  removeHighlight,
  clearSelectedVerses,
  selectedVerses,
  selectAllVerses,
  version,
  onAddToStudy,
  onAddBookmark,
  onPinVerses,
  onEnterAnnotationMode,
  focusVerses,
}: Props) => {
  const router = useRouter()
  const { t } = useTranslation()
  const theme = useTheme()
  const { width: screenWidth } = useWindowDimensions()
  const openedFromTab = useAtomValue(openedFromTabAtom)
  const selectedVersesTitle = verseToReference(selectedVerses)
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const translateX = useSharedValue(0)

  // Create memoized selectors for detecting active states
  const selectNotesForVerse = useMemo(() => makeNotesForVerseSelector(), [])
  const selectHasTaggedItems = useMemo(() => makeHasTaggedItemsForVerseSelector(), [])
  const selectLinksByChapter = useMemo(() => makeLinksByChapterSelector(), [])
  const selectBookmarkForVerse = useMemo(() => makeSelectBookmarkForVerse(), [])

  // Get the first selected verse for checking active states
  const firstVerseKey = Object.keys(selectedVerses)[0]
  const [bookStr, chapterStr, verseStr] = firstVerseKey?.split('-') || []
  const book = bookStr ? parseInt(bookStr) : 0
  const chapter = chapterStr ? parseInt(chapterStr) : 0
  const verse = verseStr ? parseInt(verseStr) : 0

  // Check if the selected verse has a note
  const hasNote = useSelector((state: RootState) => {
    if (!firstVerseKey) return false
    const notes = selectNotesForVerse(state, firstVerseKey)
    return notes.length > 0
  })

  // Check if the selected verse has tags
  const hasTags = useSelector((state: RootState) => {
    if (!firstVerseKey) return false
    return selectHasTaggedItems(state, firstVerseKey)
  })

  // Check if the selected verse has a link
  const hasLink = useSelector((state: RootState) => {
    if (!firstVerseKey || !book || !chapter) return false
    const links = selectLinksByChapter(state, book, chapter)
    return !!links[firstVerseKey]
  })

  // Check if the selected verse has a bookmark
  const hasBookmark = useSelector((state: RootState) => {
    if (!book || !chapter || !verse) return false
    return !!selectBookmarkForVerse(state, book, chapter, verse)
  })

  // Check if focus mode is active for selected verses
  const hasFocus =
    focusVerses?.some(v => Object.keys(selectedVerses).some(key => key.endsWith(`-${v}`))) ?? false

  const close = () => {
    ref?.current?.close()
  }

  const { hasVerseNumbers, hasInlineVerses, hasQuotes, hasAppName } = useShareOptions()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)

  const shareVerse = async () => {
    const { all: message } = await getVersesContent({
      verses: selectedVerses,
      version,
      hasVerseNumbers,
      hasInlineVerses,
      hasQuotes,
      hasAppName,
    })
    await Share.share({ message })
  }

  const copyToClipboard = async () => {
    const { all: message } = await getVersesContent({
      verses: selectedVerses,
      version,
      hasVerseNumbers,
      hasInlineVerses,
      hasQuotes,
      hasAppName,
    })
    Clipboard.setString(message)
    toast(t('Copié dans le presse-papiers.'))
  }

  const showStrongDetail = () => {
    onChangeResourceType('strong')
  }

  const openCommentariesScreen = () => {
    onChangeResourceType('commentary')
  }

  const showDictionaryDetail = () => {
    onChangeResourceType('dictionary')
  }

  const compareVerses = () => {
    router.push({
      pathname: '/bible-compare-verses',
      params: { selectedVerses: JSON.stringify(selectedVerses) },
    })
  }

  const onOpenReferences = () => {
    onChangeResourceType('reference')
  }

  const onOpenNave = () => {
    onChangeResourceType('nave')
  }

  const sendVerseData = async () => {
    const { title, content } = await getVersesContent({
      verses: selectedVerses,
      version,
    })
    const store = getDefaultStore()
    const currentStudyId = store.get(currentStudyIdAtom)
    const pathname = openedFromTab ? '/' : '/edit-study'
    router.dismissTo({
      pathname,
      params: {
        ...cleanParams(),
        studyId: currentStudyId,
        type: isSelectionMode,
        title,
        content,
        version,
        verses: JSON.stringify(Object.keys(selectedVerses)),
      },
    })
    close()
  }

  const moreThanOneVerseSelected = Object.keys(selectedVerses).length > 1
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const onClose = () => {
    clearSelectedVerses()
  }

  const { bottomBarHeight } = useBottomBarHeightInTab()
  const startX = useSharedValue(0)

  // Tab indicator dimensions (moved here so panGesture can use tabWidth)
  const TAB_CONTAINER_MARGIN = 16 * 2
  const TAB_CONTAINER_PADDING = 3
  const containerWidth = screenWidth - TAB_CONTAINER_MARGIN
  const tabWidth = (containerWidth - TAB_CONTAINER_PADDING * 2) / TABS.length

  const goToTab = (index: number) => {
    setActiveTabIndex(index)
    translateX.set(withSpring(-index * screenWidth))
  }

  const updateActiveTab = (index: number) => {
    setActiveTabIndex(index)
  }

  // Scale: finger drag on tabWidth → content moves screenWidth (so indicator follows finger 1:1)
  const dragScale = screenWidth / tabWidth
  const minTranslateX = -(TABS.length - 1) * screenWidth
  const maxTranslateX = 0
  const overscrollResistance = 4 // Higher = more resistance

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.set(translateX.get())
    })
    .onUpdate(event => {
      // Inverted & scaled: indicator follows finger 1:1
      let newTranslateX = startX.get() - event.translationX * dragScale

      // Apply resistance when overscrolling
      if (newTranslateX > maxTranslateX) {
        const overscroll = newTranslateX - maxTranslateX
        newTranslateX = maxTranslateX + overscroll / overscrollResistance
      } else if (newTranslateX < minTranslateX) {
        const overscroll = minTranslateX - newTranslateX
        newTranslateX = minTranslateX - overscroll / overscrollResistance
      }

      translateX.set(newTranslateX)
    })
    .onEnd(event => {
      const currentPosition = translateX.get()
      const velocity = -event.velocityX * dragScale // Inverted & scaled velocity

      // Calculate which tab to snap to based on position and velocity
      let targetIndex = Math.round(-currentPosition / screenWidth)

      // Add velocity influence for more natural feel
      if (Math.abs(velocity) > 800) {
        if (velocity > 0) {
          targetIndex = Math.max(0, targetIndex - 1)
        } else {
          targetIndex = Math.min(TABS.length - 1, targetIndex + 1)
        }
      }

      // Clamp to valid range
      targetIndex = Math.max(0, Math.min(TABS.length - 1, targetIndex))

      translateX.set(withSpring(-targetIndex * screenWidth))
      runOnJS(updateActiveTab)(targetIndex)
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }))

  // Animated style for the sliding indicator
  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const progress = -translateX.get() / screenWidth
    const indicatorLeft = progress * tabWidth + TAB_CONTAINER_PADDING
    return {
      left: indicatorLeft,
    }
  })

  const scrollViewContentContainerStyle = { paddingHorizontal: 16 }

  const renderAnnotateTab = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={scrollViewContentContainerStyle}
      style={{ width: screenWidth }}
    >
      <ActionItem
        name={hasNote ? 'file-text' : 'file-plus'}
        label={t('Note')}
        onPress={onCreateNoteClick}
        isActive={hasNote}
      />
      <ActionItem name="tag" label={t('Tag')} onPress={addTag} isActive={hasTags} />
      <ActionItem name="link" label={t('Lien')} onPress={onCreateLinkClick} isActive={hasLink} />
      <ActionItem
        name="bookmark"
        label={t('Marque-page')}
        onPress={onAddBookmark}
        disabled={moreThanOneVerseSelected}
        isActive={hasBookmark}
      />
      <ActionItem name="feather" label={t('study.addToStudy')} onPress={onAddToStudy} />
      <ActionItem name="crosshair" label={t('Focus')} onPress={onPinVerses} isActive={hasFocus} />
      {onEnterAnnotationMode && (
        <ActionItem name="edit-2" label={t('Mode libre')} onPress={onEnterAnnotationMode} />
      )}
    </ScrollView>
  )

  const renderStudyTab = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={scrollViewContentContainerStyle}
      style={{ width: screenWidth }}
    >
      <ActionItem
        svgSource={require('~assets/images/tab-icons/lexique.svg')}
        tintColor={theme.colors.primary}
        label={t('Lexique')}
        onPress={showStrongDetail}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/dictionary.svg')}
        tintColor={theme.colors.secondary}
        label={t('Dictionnaire')}
        onPress={showDictionaryDetail}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/nave.svg')}
        tintColor={theme.colors.quint}
        label={t('Thèmes')}
        onPress={onOpenNave}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/references.svg')}
        tintColor={theme.colors.quart}
        label={t('Références')}
        onPress={onOpenReferences}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/comment.svg')}
        tintColor="#26A69A"
        label={t('Commentaire')}
        onPress={openCommentariesScreen}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem name="layers" label={t('Comparer')} onPress={compareVerses} />
    </ScrollView>
  )

  const renderShareTab = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={scrollViewContentContainerStyle}
      style={{ width: screenWidth }}
    >
      <ActionItem name="copy" label={t('Copier')} onPress={copyToClipboard} />
      <ActionItem name="share-2" label={t('Partager')} onPress={shareVerse} />
      <ActionItem name="check-square" label={t('Tout sélect.')} onPress={selectAllVerses} />
    </ScrollView>
  )

  const renderFooter = (props: BottomSheetFooterProps) => (
    <BottomSheetFooter {...props}>
      <AnimatedBox
        bg="lightGrey"
        borderRadius={10}
        p={3}
        mx={16}
        mb={(isFullScreenBible ? BOTTOM_INSET : bottomBarHeight) + 10}
        position="relative"
        style={{
          transitionProperty: 'margin',
          transitionDuration: 300,
        }}
      >
        {/* Sliding indicator */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: TAB_CONTAINER_PADDING,
              bottom: TAB_CONTAINER_PADDING,
              width: tabWidth,
              backgroundColor: theme.colors.reverse,
              borderRadius: 8,
            },
            indicatorAnimatedStyle,
          ]}
        />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={{ flexDirection: 'row' }}>
            <TabButton
              label={t('tabs.annotate')}
              isActive={activeTabIndex === 0}
              onPress={() => goToTab(0)}
            />
            <TabButton
              label={t('tabs.study')}
              isActive={activeTabIndex === 1}
              onPress={() => goToTab(1)}
            />
            <TabButton
              label={t('tabs.share')}
              isActive={activeTabIndex === 2}
              onPress={() => goToTab(2)}
            />
          </Animated.View>
        </GestureDetector>
      </AnimatedBox>
    </BottomSheetFooter>
  )

  const TAB_FOOTER_HEIGHT = 63

  return (
    <BottomSheet
      ref={ref}
      onAnimate={onAnimateModalClose(onClose)}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      activeOffsetY={[-20, 20]}
      key={key}
      footerComponent={renderFooter}
      {...bottomSheetStyles}
      style={{
        ...(bottomSheetStyles.style as object),
      }}
    >
      <BottomSheetView style={{ flex: 0 }}>
        {typeof isSelectionMode === 'string' && isSelectionMode.includes('verse') ? (
          <HStack gap={10} width="100%" alignItems="center" justifyContent="center" py={10}>
            <Text bold fontSize={18} textAlign="center">
              {selectedVersesTitle.toUpperCase()}
            </Text>
            <TouchableIcon name="arrow-right" size={20} onPress={sendVerseData} noFlex />
          </HStack>
        ) : typeof isSelectionMode === 'string' && isSelectionMode.includes('strong') ? (
          <></>
        ) : (
          <Box
            style={{
              overflow: 'hidden',

              paddingBottom:
                TAB_FOOTER_HEIGHT + (isFullScreenBible ? BOTTOM_INSET : bottomBarHeight),
            }}
          >
            <ColorCirclesBar
              selectedVerseHighlightColor={selectedVerseHighlightColor}
              addHighlight={addHighlight}
              removeHighlight={removeHighlight}
              onClose={close}
            />
            <Animated.View
              style={[
                {
                  flexDirection: 'row',
                  width: screenWidth * TABS.length,
                  alignItems: 'flex-start',
                },
                animatedStyle,
              ]}
            >
              {renderAnnotateTab()}
              {renderStudyTab()}
              {renderShareTab()}
            </Animated.View>
          </Box>
        )}
      </BottomSheetView>
    </BottomSheet>
  )
}

export default VersesModal
