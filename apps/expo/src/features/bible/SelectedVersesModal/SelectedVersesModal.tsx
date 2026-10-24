import { SheetView } from '~common/sheet'
import { useAtom } from 'jotai/react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { BOTTOM_INSET } from '~helpers/constants'
import verseToReference from '../../../helpers/verseToReference'
import ColorCirclesBar from '../ColorCirclesBar'
import TouchableIcon from '../TouchableIcon'
import AnnotateTab from './components/AnnotateTab'
import SelectionGroupsPager from './components/SelectionGroupsPager'
import ShareTab from './components/ShareTab'
import StudyTab from './components/StudyTab'
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
          <SelectionGroupsPager
            activeTabIndex={activeTabIndex}
            setActiveTabIndex={setActiveTabIndex}
            header={
              <ColorCirclesBar
                selectedVerseHighlightColor={selectedVerseHighlightColor}
                addHighlight={addHighlight}
                removeHighlight={removeHighlight}
                onClose={close}
              />
            }
            groups={[
              width => (
                <AnnotateTab
                  version={version}
                  selectedVerses={selectedVerses}
                  screenWidth={width}
                  onCreateNoteClick={onCreateNoteClick}
                  addTag={addTag}
                  onCreateLinkClick={onCreateLinkClick}
                  onCreateStudyRelationClick={onCreateStudyRelationClick}
                  onAddBookmark={onAddBookmark}
                  onAddToStudy={onAddToStudy}
                  onSelectStudy={onSelectStudy}
                  reference={selectedVersesTitle}
                  moreThanOneVerseSelected={moreThanOneVerseSelected}
                  activeStates={activeStates}
                />
              ),
              width => (
                <StudyTab
                  screenWidth={width}
                  onPinVerses={onPinVerses}
                  hasFocus={activeStates.hasFocus}
                  showStrongDetail={showStrongDetail}
                  showDictionaryDetail={showDictionaryDetail}
                  onOpenNave={onOpenNave}
                  onOpenReferences={onOpenReferences}
                  openCommentariesScreen={openCommentariesScreen}
                  compareVerses={compareVerses}
                  moreThanOneVerseSelected={moreThanOneVerseSelected}
                />
              ),
              width => (
                <ShareTab
                  screenWidth={width}
                  copyToClipboard={copyToClipboard}
                  shareVerse={shareVerse}
                  exportPassage={onExportPassage}
                  selectAllVerses={selectAllVerses}
                />
              ),
            ]}
          />
        )}
      </SheetView>
    </>
  )
}

export default SelectedVersesModal
