import { SheetView } from '~common/sheet'
import Sheet from './SelectionSheet'
import { useAtom } from 'jotai/react'
import { useRef } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { BOTTOM_INSET } from '~helpers/constants'
import verseToReference from '../../../helpers/verseToReference'
import ColorCirclesBar from '../ColorCirclesBar'
import TouchableIcon from '../TouchableIcon'
import AnnotateTab from './components/AnnotateTab'
import ShareTab from './components/ShareTab'
import SelectionGroups from './components/SelectionGroups'
import StudyTab from './components/StudyTab'
import VersesModalFooter from './components/VersesModalFooter'
import { TABS } from './constants'
import { SELECTION_GROUP_WIDTH } from './selectionSheetLayout'
import useTabSwipeGesture from './hooks/useTabSwipeGesture'
import useVerseActions from './hooks/useVerseActions'
import useVerseActiveStates from './hooks/useVerseActiveStates'
import type { SelectedVersesModalProps } from './types'
import PassageExportSheet from '../passageExport/PassageExportSheet'
import type { SheetRef } from '~common/sheet'
// Persist the selected tab index
const selectedVersesTabIndexAtom = atomWithAsyncStorage('selectedVersesTabIndex', 0)

const SelectedVersesModal = ({
  ref,
  isSelectionMode,
  selectedVerseHighlightColor,
  onChangeResourceType,
  onCreateNoteClick,
  onCreateLinkClick,
  onCreateStudyRelationClick,
  addHighlight,
  addTag,
  removeHighlight,
  clearSelectedVerses,
  selectedVerses,
  selectAllVerses,
  version,
  onAddToStudy,
  onSelectStudy,
  onAddBookmark,
  onPinVerses,
  onEnterAnnotationMode,
  focusVerses,
}: SelectedVersesModalProps) => {
  const { t } = useTranslation()
  const exportSheetRef = useRef<SheetRef>(null)
  const selectedVersesTitle = verseToReference(selectedVerses)
  const [activeTabIndex, setActiveTabIndex] = useAtom(selectedVersesTabIndexAtom)

  const close = () => {
    ref?.current?.close()
  }

  const activeStates = useVerseActiveStates({
    selectedVerses,
    focusVerses,
  })

  const {
    panGesture,
    animatedStyle,
    indicatorAnimatedStyle,
    goToTab,
    tabWidth,
    screenWidth,
    setContentWidth,
    setTabContainerWidth,
  } = useTabSwipeGesture({
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

  const expanded = Platform.OS === 'web'
  const groupWidth = expanded ? SELECTION_GROUP_WIDTH : screenWidth

  const moreThanOneVerseSelected = Object.keys(selectedVerses).length > 1

  const onClose = () => {
    clearSelectedVerses()
  }

  return (
    <>
      <Sheet ref={ref} onDismiss={onClose} backdrop={false}>
        <SheetView
          style={{ flex: 0, paddingTop: 10, paddingBottom: Platform.OS === 'web' ? 12 : 0 }}
        >
          {typeof isSelectionMode === 'string' && isSelectionMode.includes('verse') ? (
            <HStack
              className="overflow-hidden border-continuous gap-[10px] w-[100%] items-center justify-center pt-[10px]"
              style={{ paddingBottom: BOTTOM_INSET }}
            >
              <Text className="font-bold text-[18px] text-center">
                {selectedVersesTitle.toUpperCase()}
              </Text>
              <TouchableIcon
                accessibilityLabel={t('Continuer')}
                name="arrow-right"
                size={20}
                onPress={sendVerseData}
                noFlex
              />
            </HStack>
          ) : typeof isSelectionMode === 'string' && isSelectionMode.includes('strong') ? (
            <></>
          ) : (
            <Box
              onLayout={event => setContentWidth(event.nativeEvent.layout.width)}
              className="overflow-hidden border-continuous"
              style={{
                overflow: 'hidden',
              }}
            >
              <ColorCirclesBar
                selectedVerseHighlightColor={selectedVerseHighlightColor}
                addHighlight={addHighlight}
                removeHighlight={removeHighlight}
                onClose={close}
              />
              <SelectionGroups>
                <Animated.View
                  key={expanded ? 'expanded' : 'tabs'}
                  style={[
                    {
                      flexDirection: 'row',
                      width: groupWidth * TABS.length,
                      alignItems: 'flex-start',
                    },
                    !expanded && animatedStyle,
                  ]}
                >
                  <Box style={{ width: groupWidth, flexShrink: 0 }}>
                    {expanded && (
                      <Text className="text-center uppercase text-[11px] font-medium tracking-[1px] text-tertiary opacity-60 py-[10px]">
                        {t('tabs.annotate')}
                      </Text>
                    )}
                    <AnnotateTab
                      version={version}
                      selectedVerses={selectedVerses}
                      screenWidth={groupWidth}
                      onCreateNoteClick={onCreateNoteClick}
                      addTag={addTag}
                      onCreateLinkClick={onCreateLinkClick}
                      onCreateStudyRelationClick={onCreateStudyRelationClick}
                      onAddBookmark={onAddBookmark}
                      onAddToStudy={onAddToStudy}
                      onSelectStudy={onSelectStudy}
                      reference={selectedVersesTitle}
                      onPinVerses={onPinVerses}
                      onEnterAnnotationMode={onEnterAnnotationMode}
                      moreThanOneVerseSelected={moreThanOneVerseSelected}
                      activeStates={activeStates}
                    />
                  </Box>
                  <Box style={{ width: groupWidth, flexShrink: 0 }}>
                    {expanded && (
                      <Text className="text-center uppercase text-[11px] font-medium tracking-[1px] text-tertiary opacity-60 py-[10px]">
                        {t('tabs.study')}
                      </Text>
                    )}
                    <StudyTab
                      screenWidth={groupWidth}
                      showStrongDetail={showStrongDetail}
                      showDictionaryDetail={showDictionaryDetail}
                      onOpenNave={onOpenNave}
                      onOpenReferences={onOpenReferences}
                      openCommentariesScreen={openCommentariesScreen}
                      compareVerses={compareVerses}
                      moreThanOneVerseSelected={moreThanOneVerseSelected}
                    />
                  </Box>
                  <Box style={{ width: groupWidth, flexShrink: 0 }}>
                    {expanded && (
                      <Text className="text-center uppercase text-[11px] font-medium tracking-[1px] text-tertiary opacity-60 py-[10px]">
                        {t('tabs.share')}
                      </Text>
                    )}
                    <ShareTab
                      screenWidth={groupWidth}
                      copyToClipboard={copyToClipboard}
                      shareVerse={shareVerse}
                      exportPassage={() => exportSheetRef.current?.present()}
                      selectAllVerses={selectAllVerses}
                    />
                  </Box>
                </Animated.View>
              </SelectionGroups>
              {Platform.OS !== 'web' && (
                <VersesModalFooter
                  onContainerWidthChange={setTabContainerWidth}
                  panGesture={panGesture}
                  indicatorAnimatedStyle={indicatorAnimatedStyle}
                  tabWidth={tabWidth}
                  activeTabIndex={activeTabIndex}
                  goToTab={goToTab}
                />
              )}
            </Box>
          )}
        </SheetView>
      </Sheet>
      <PassageExportSheet
        ref={exportSheetRef}
        sourceType="selection"
        selectedVerses={selectedVerses}
        version={version}
      />
    </>
  )
}

export default SelectedVersesModal
