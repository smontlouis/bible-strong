import type { BottomSheetFooterProps } from '@gorhom/bottom-sheet'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { useAtom, useAtomValue } from 'jotai/react'
import Animated from 'react-native-reanimated'
import { isFullScreenBibleAtom } from 'src/state/app'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { onAnimateModalClose, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { BOTTOM_INSET } from '~helpers/constants'
import verseToReference from '../../../helpers/verseToReference'
import ColorCirclesBar from '../ColorCirclesBar'
import TouchableIcon from '../TouchableIcon'
import AnnotateTab from './components/AnnotateTab'
import ShareTab from './components/ShareTab'
import StudyTab from './components/StudyTab'
import VersesModalFooter from './components/VersesModalFooter'
import { TABS, TAB_FOOTER_HEIGHT } from './constants'
import useTabSwipeGesture from './hooks/useTabSwipeGesture'
import useVerseActions from './hooks/useVerseActions'
import useVerseActiveStates from './hooks/useVerseActiveStates'
import type { SelectedVersesModalProps } from './types'

// Persist the selected tab index
const selectedVersesTabIndexAtom = atomWithAsyncStorage('selectedVersesTabIndex', 0)

const SelectedVersesModal = ({
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
}: SelectedVersesModalProps) => {
  const selectedVersesTitle = verseToReference(selectedVerses)
  const [activeTabIndex, setActiveTabIndex] = useAtom(selectedVersesTabIndexAtom)
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const { bottomBarHeight } = useBottomBarHeightInTab()

  const close = () => {
    ref?.current?.close()
  }

  const activeStates = useVerseActiveStates({
    selectedVerses,
    focusVerses,
  })

  const { panGesture, animatedStyle, indicatorAnimatedStyle, goToTab, tabWidth, screenWidth } =
    useTabSwipeGesture({
      activeTabIndex,
      setActiveTabIndex,
    })

  const {
    shareVerse,
    copyToClipboard,
    showStrongDetail,
    openCommentariesScreen,
    showDictionaryDetail,
    compareVerses,
    onOpenReferences,
    onOpenNave,
    sendVerseData,
  } = useVerseActions({
    selectedVerses,
    version,
    isSelectionMode,
    onClose: close,
    onChangeResourceType,
  })

  const moreThanOneVerseSelected = Object.keys(selectedVerses).length > 1
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const onClose = () => {
    clearSelectedVerses()
  }

  const renderFooter =
    typeof isSelectionMode === 'string' && isSelectionMode.includes('verse')
      ? undefined
      : (props: BottomSheetFooterProps) => (
          <VersesModalFooter
            bottomSheetFooterProps={props}
            panGesture={panGesture}
            indicatorAnimatedStyle={indicatorAnimatedStyle}
            tabWidth={tabWidth}
            activeTabIndex={activeTabIndex}
            goToTab={goToTab}
          />
        )

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
          <HStack
            gap={10}
            width="100%"
            alignItems="center"
            justifyContent="center"
            pt={10}
            pb={BOTTOM_INSET}
          >
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
              <AnnotateTab
                screenWidth={screenWidth}
                onCreateNoteClick={onCreateNoteClick}
                addTag={addTag}
                onCreateLinkClick={onCreateLinkClick}
                onAddBookmark={onAddBookmark}
                onAddToStudy={onAddToStudy}
                onPinVerses={onPinVerses}
                onEnterAnnotationMode={onEnterAnnotationMode}
                moreThanOneVerseSelected={moreThanOneVerseSelected}
                activeStates={activeStates}
              />
              <StudyTab
                screenWidth={screenWidth}
                showStrongDetail={showStrongDetail}
                showDictionaryDetail={showDictionaryDetail}
                onOpenNave={onOpenNave}
                onOpenReferences={onOpenReferences}
                openCommentariesScreen={openCommentariesScreen}
                compareVerses={compareVerses}
                moreThanOneVerseSelected={moreThanOneVerseSelected}
              />
              <ShareTab
                screenWidth={screenWidth}
                copyToClipboard={copyToClipboard}
                shareVerse={shareVerse}
                selectAllVerses={selectAllVerses}
              />
            </Animated.View>
          </Box>
        )}
      </BottomSheetView>
    </BottomSheet>
  )
}

export default SelectedVersesModal
