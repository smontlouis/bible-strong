import { useSetAtom } from 'jotai/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet } from 'react-native'
import ColorCircleGrid from '~common/ColorCircleGrid'
import { SheetView } from '~common/sheet'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useColorItems } from '~helpers/useHighlightColors'
import { colorPickerModalAtom } from 'src/state/app'
import {
  AnnotationTypeSwitch,
  useAnnotationTools,
  type AnnotationToolbarProps,
} from './AnnotationControls'
import { AnnotationAnnotateTab, AnnotationShareTab, AnnotationStudyTab } from './AnnotationGroups'
import SelectionGroupsPager from './SelectedVersesModal/components/SelectionGroupsPager'
import useAnnotationWordActions from './useAnnotationWordActions'
import useSelectionStrongWords from './useSelectionStrongWords'

// Circles beside the type switch: narrower than the verses' row, which spans the sheet
const COLOR_ITEM_WIDTH = 44

/**
 * The selected words and what can be done with them, in the selection sheet (see
 * BibleSelectionSheet): the same skeleton as selected verses, with the ways to mark words in
 * place of the verses' colors. On desktop, useAnnotationSelectionMenu shows them beside the verse.
 */
const AnnotationSheetContent = (props: AnnotationToolbarProps) => {
  const {
    selectedAnnotation,
    onFocusVerses,
    tagsCount = 0,
    relationsCount = 0,
    annotatedVersion,
    verses = [],
  } = props
  const { t } = useTranslation()
  const colorItems = useColorItems()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)
  const tools = useAnnotationTools(props)
  const strongWords = useSelectionStrongWords(annotatedVersion, tools.wordRanges, verses)
  const wordActions = useAnnotationWordActions(annotatedVersion, tools.wordRanges)
  // Each session opens on its annotation's tools
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const hasWords = !tools.disabled && tools.wordRanges.length > 0

  const header = (
    <HStack
      className="items-center gap-[10px] pl-[16px]"
      style={{ opacity: tools.disabled ? 0.5 : 1 }}
    >
      <AnnotationTypeSwitch
        disabled={tools.disabled}
        activeType={tools.activeAnnotationType}
        onChange={tools.setActiveAnnotationType}
        getColor={tools.getColor}
      />
      <Box className="h-[24px] bg-separator" style={{ width: StyleSheet.hairlineWidth }} />
      <Box className="flex-1 min-w-0" pointerEvents={tools.disabled ? 'none' : 'auto'}>
        <ColorCircleGrid
          colors={colorItems}
          selectedColor={tools.selectedColor}
          onSelect={colorKey => tools.apply(colorKey, tools.activeAnnotationType)}
          showAddButton
          onAddPress={() =>
            setColorPickerModal({
              selectedColor: tools.selectedColor,
              onSelectColor: colorKey => tools.apply(colorKey, tools.activeAnnotationType),
            })
          }
          itemWidth={COLOR_ITEM_WIDTH}
          itemHeight={56}
        />
      </Box>
    </HStack>
  )

  return (
    <SheetView
      style={{ flex: 0, paddingTop: 10, paddingBottom: Platform.OS === 'web' ? 12 : 0 }}
      testID="annotation-toolbar"
    >
      <HStack className="px-[16px] pb-[4px] items-center gap-[8px]">
        <Text
          className={
            tools.reference
              ? 'font-bold text-[16px] flex-shrink'
              : 'text-[15px] text-grey flex-shrink'
          }
          numberOfLines={1}
        >
          {tools.reference ?? t('Sélectionnez des mots')}
        </Text>
        {annotatedVersion && (
          <Box
            className="rounded-full px-[7px] py-[2px] bg-light-grey"
            testID="annotation-toolbar-version"
          >
            <Text className="text-[12px] font-bold text-link">{annotatedVersion}</Text>
          </Box>
        )}
      </HStack>
      <SelectionGroupsPager
        activeTabIndex={activeTabIndex}
        setActiveTabIndex={setActiveTabIndex}
        header={header}
        groups={[
          width => (
            <AnnotationAnnotateTab
              screenWidth={width}
              hasNote={!!selectedAnnotation?.noteId}
              tagsCount={tagsCount}
              relationsCount={relationsCount}
              noteDisabled={tools.noteDisabled}
              tagsDisabled={tools.tagsDisabled}
              relationsDisabled={tools.relationsDisabled}
              onNotePress={tools.openNote}
              onTagsPress={tools.openTags}
              onRelationsPress={tools.openRelations}
              erase={tools.erase}
              isAnnotation={!!selectedAnnotation}
            />
          ),
          width => (
            <AnnotationStudyTab
              screenWidth={width}
              hasFocus={tools.hasFocus}
              focusDisabled={!hasWords || !onFocusVerses}
              onFocus={() => onFocusVerses?.(tools.verseKeys)}
              version={annotatedVersion}
              strongWords={tools.disabled ? { status: 'none' } : strongWords}
              onOpenWord={wordActions.openWord}
            />
          ),
          width => (
            <AnnotationShareTab
              screenWidth={width}
              disabled={!hasWords}
              onCopy={wordActions.copy}
              onShare={wordActions.share}
            />
          ),
        ]}
      />
    </SheetView>
  )
}

export default AnnotationSheetContent
