import { SheetView } from '~common/sheet'
import { useAtom } from 'jotai/react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'
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
import { selectedVersesTabIndexAtom } from './selectedVersesTabIndex'

/**
 * The selected verses and what can be done with them: colors, then three groups of actions. The
 * selection sheet shows it (see BibleSelectionSheet); on desktop, useVerseSelectionMenu does.
 */
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
  selectedVerses,
  selectAllVerses,
  version,
  onAddToStudy,
  onSelectStudy,
  onAddBookmark,
  onPinVerses,
  onExportPassage,
  focusVerses,
}: SelectedVersesModalProps) => {
  const { t } = useTranslation()
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

  // The selection sheet holds it (see BibleSelectionSheet)
  return (
    <>
      <SheetView style={{ flex: 0, paddingTop: 10, paddingBottom: Platform.OS === 'web' ? 12 : 0 }}>
        {typeof isSelectionMode === 'string' && isSelectionMode.includes('verse') ? (
          <HStack
            className="overflow-hidden border-continuous gap-[10px] w-[100%] items-center justify-center pt-[10px]"
            style={{ paddingBottom: BOTTOM_INSET }}
          >
            <Text className="font-semibold text-[18px] text-center">{selectedVersesTitle}</Text>
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
                    <Text className="text-center text-[13px] text-grey py-[10px]">
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
                    moreThanOneVerseSelected={moreThanOneVerseSelected}
                    activeStates={activeStates}
                  />
                </Box>
                <Box style={{ width: groupWidth, flexShrink: 0 }}>
                  {expanded && (
                    <Text className="text-center text-[13px] text-grey py-[10px]">
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
                    <Text className="text-center text-[13px] text-grey py-[10px]">
                      {t('tabs.share')}
                    </Text>
                  )}
                  <ShareTab
                    screenWidth={groupWidth}
                    copyToClipboard={copyToClipboard}
                    shareVerse={shareVerse}
                    exportPassage={onExportPassage}
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
    </>
  )
}

export default SelectedVersesModal
