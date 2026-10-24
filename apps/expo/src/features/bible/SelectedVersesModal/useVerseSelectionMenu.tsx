import { useAtom } from 'jotai/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelNavigation, PanelScreen } from '~common/ContextualPanel/types'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBibleBookmarkScreens } from '~features/bookmarks/useBibleBookmarkScreens'
import { useAddToStudyScreens } from '~features/studies/useAddToStudyScreens'
import { isEditingTarget } from '~features/keyboard-shortcuts/keyboardTargets'
import { digitOf, findShortcut, matchShortcut } from '~features/keyboard-shortcuts/keymap'
import { useColorItems } from '~helpers/useHighlightColors'
import verseToReference from '../../../helpers/verseToReference'
import {
  BIBLE_SELECTION_MENU_WIDTH,
  type BibleSelectionMenuContent,
} from '../bibleSelectionMenuContent'
import ColorCirclesBar from '../ColorCirclesBar'
import { getSelectedVersesBookmarkLocation } from '../selectedVersesActions'
import AnnotateTab from './components/AnnotateTab'
import SelectionMenuTabs from './components/SelectionMenuTabs'
import ShareTab from './components/ShareTab'
import StudyTab from './components/StudyTab'
import useVerseActions from './hooks/useVerseActions'
import useVerseActiveStates from './hooks/useVerseActiveStates'
import { selectedVersesTabIndexAtom } from './selectedVersesTabIndex'
import { SelectionMenuContext, type SelectionMenu } from './selectionMenuContext'
import { SELECTION_GROUP_WIDTH } from './selectionSheetLayout'
import type { SelectedVersesModalProps } from './types'

const SELECTION_SHORTCUTS = [
  'highlight',
  'removeHighlight',
  'note',
  'tags',
  'link',
  'relation',
  'bookmark',
  'addToStudy',
  'focus',
  'lexicon',
  'dictionary',
  'topics',
  'references',
  'commentary',
  'compare',
  'copy',
  'selectAll',
] as const

type SelectionShortcutId = (typeof SELECTION_SHORTCUTS)[number]

/**
 * The selected verses in the desktop selection menu: the colors and three groups of actions of the
 * sheet, opened beside the last verse selected. Its keys act on the selection while it shows.
 * Its own button and Escape end the selection.
 */
export default function useVerseSelectionMenu(
  {
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
    onExportPassage,
    focusVerses,
  }: SelectedVersesModalProps,
  isShown: boolean
): BibleSelectionMenuContent {
  const { t } = useTranslation()
  const reference = verseToReference(selectedVerses)
  const [activeTabIndex, setActiveTabIndex] = useAtom(selectedVersesTabIndexAtom)
  const navigation = useRef<PanelNavigation | null>(null)
  const isOpen = useRef(false)

  const close = () => {
    ref?.current?.close()
  }

  const activeStates = useVerseActiveStates({ selectedVerses, focusVerses })
  const {
    shareVerse,
    copyToClipboard,
    showStrongDetail,
    openCommentariesScreen,
    showDictionaryDetail,
    compareVerses,
    onOpenReferences,
    onOpenNave,
  } = useVerseActions({
    selectedVerses,
    version,
    isSelectionMode,
    onClose: close,
    onChangeResourceType,
  })

  const tags = useEntityTagsScreen('highlights', selectedVerses)
  const location = getSelectedVersesBookmarkLocation(selectedVerses)
  const bookmark = useBibleBookmarkScreens(
    location?.book ?? 1,
    location?.chapter ?? 1,
    version,
    location?.verse
  )
  const study = useAddToStudyScreens({ onSelect: onSelectStudy, reference })

  const menu: SelectionMenu = {
    openScreen: name => navigation.current?.open(name),
  }

  const moreThanOneVerseSelected = Object.keys(selectedVerses).length > 1
  const single = !moreThanOneVerseSelected
  // The digits pick the colours in the order of the bar above the actions.
  const colorItems = useColorItems()
  const shortcuts: Partial<Record<SelectionShortcutId, (event: KeyboardEvent) => void>> = {
    highlight: event => {
      const color = colorItems[(digitOf(event) ?? 0) - 1]?.key
      if (!color) return
      if (color === selectedVerseHighlightColor) removeHighlight()
      else addHighlight(color)
    },
    removeHighlight: selectedVerseHighlightColor ? removeHighlight : undefined,
    note: onCreateNoteClick,
    tags: () => menu.openScreen('tags'),
    link: onCreateLinkClick,
    relation: onCreateStudyRelationClick,
    bookmark: single && location ? () => menu.openScreen('bookmark') : undefined,
    addToStudy: study.available ? () => menu.openScreen('study') : onAddToStudy,
    focus: onPinVerses,
    lexicon: single ? showStrongDetail : undefined,
    dictionary: single ? showDictionaryDetail : undefined,
    topics: single ? onOpenNave : undefined,
    references: single ? onOpenReferences : undefined,
    commentary: single ? openCommentariesScreen : undefined,
    compare: compareVerses,
    copy: copyToClipboard,
    selectAll: selectAllVerses,
  }

  useEffect(() => {
    if (!isShown) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditingTarget(event.target)) return
      if (matchShortcut(event, 'deselect')) {
        event.preventDefault()
        clearSelectedVerses()
        return
      }
      if (!isOpen.current || event.repeat) return
      const action = findShortcut(event, SELECTION_SHORTCUTS)
      const handler = action && shortcuts[action]
      // Copying text the reader selected by hand keeps the browser's behaviour.
      if (!handler || (action === 'copy' && !window.getSelection()?.isCollapsed)) return
      event.preventDefault()
      handler(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const tabs = [
    <AnnotateTab
      key="annotate"
      version={version}
      selectedVerses={selectedVerses}
      screenWidth={SELECTION_GROUP_WIDTH}
      onCreateNoteClick={onCreateNoteClick}
      addTag={addTag}
      onCreateLinkClick={onCreateLinkClick}
      onCreateStudyRelationClick={onCreateStudyRelationClick}
      onAddBookmark={onAddBookmark}
      onAddToStudy={onAddToStudy}
      onSelectStudy={onSelectStudy}
      reference={reference}
      moreThanOneVerseSelected={moreThanOneVerseSelected}
      activeStates={activeStates}
    />,
    <StudyTab
      key="study"
      screenWidth={SELECTION_GROUP_WIDTH}
      onPinVerses={onPinVerses}
      hasFocus={activeStates.hasFocus}
      showStrongDetail={showStrongDetail}
      showDictionaryDetail={showDictionaryDetail}
      onOpenNave={onOpenNave}
      onOpenReferences={onOpenReferences}
      openCommentariesScreen={openCommentariesScreen}
      compareVerses={compareVerses}
      moreThanOneVerseSelected={moreThanOneVerseSelected}
    />,
    <ShareTab
      key="share"
      screenWidth={SELECTION_GROUP_WIDTH}
      copyToClipboard={copyToClipboard}
      shareVerse={shareVerse}
      exportPassage={onExportPassage}
      selectAllVerses={selectAllVerses}
    />,
  ]

  const screens: Record<string, PanelScreen> = {
    actions: {
      title: reference,
      width: BIBLE_SELECTION_MENU_WIDTH,
      headerRight: (
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('Désélectionner')}
          onPress={clearSelectedVerses}
          className="w-[28px] h-[28px] items-center justify-center rounded-full"
        >
          <FeatherIcon name="x" size={17} color="tertiary" />
        </TouchableBox>
      ),
      headerContent: (
        <>
          <Box className="px-[10px] pt-[4px] pb-[6px]">
            <ColorCirclesBar
              compact
              selectedVerseHighlightColor={selectedVerseHighlightColor}
              addHighlight={addHighlight}
              removeHighlight={removeHighlight}
              onClose={close}
            />
          </Box>
          <SelectionMenuTabs
            labels={[t('tabs.annotate'), t('tabs.study'), t('tabs.share')]}
            activeIndex={activeTabIndex}
            onChange={setActiveTabIndex}
          />
        </>
      ),
      content: nav => {
        navigation.current = nav
        return (
          <SelectionMenuContext.Provider value={menu}>
            {tabs[activeTabIndex] ?? tabs[0]}
          </SelectionMenuContext.Provider>
        )
      },
    },
    tags: {
      ...tags.screen,
      width: 320,
      headerContent: (
        <>
          <Text className="px-3 text-[12px] text-tertiary">{reference}</Text>
          {tags.screen.headerContent}
        </>
      ),
    },
    ...Object.fromEntries(
      Object.entries(bookmark.screens).map(([name, screen]) => [
        name,
        { ...screen, width: 360, ...(name === 'bookmark' ? { onEnter: bookmark.prepare } : {}) },
      ])
    ),
    ...Object.fromEntries(
      Object.entries(study.screens).map(([name, screen]) => [name, { ...screen, width: 340 }])
    ),
  }

  const verseKeys = Object.keys(selectedVerses)

  return {
    target: { verseKey: verseKeys[verseKeys.length - 1], version },
    accessibilityLabel: reference,
    screens,
    onOpenChange: open => {
      isOpen.current = open
      if (open) return
      navigation.current = null
      tags.reset()
      study.reset()
    },
    // Escape inside the menu, or a screen that finished its task, ends the selection.
    onClose: clearSelectedVerses,
  }
}
