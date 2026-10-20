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
import verseToReference from '../../../helpers/verseToReference'
import {
  BIBLE_SELECTION_MENU_WIDTH,
  type BibleSelectionMenuContent,
} from '../bibleSelectionMenuContent'
import ColorCirclesBar from '../ColorCirclesBar'
import { getSelectedVersesBookmarkLocation } from '../selectedVersesActions'
import { isEditableTarget } from '../VerseMenu.web'
import AnnotateTab from './components/AnnotateTab'
import SelectionMenuTabs from './components/SelectionMenuTabs'
import ShareTab from './components/ShareTab'
import StudyTab from './components/StudyTab'
import useVerseActions from './hooks/useVerseActions'
import useVerseActiveStates from './hooks/useVerseActiveStates'
import { selectedVersesTabIndexAtom } from './selectedVersesTabIndex'
import { SelectionMenuContext, type SelectionMenu } from './selectionMenuContext'
import { SELECTION_GROUP_WIDTH } from './selectionSheetLayout'
import { SELECTION_SHORTCUTS, type SelectionShortcut } from './selectionShortcuts'
import type { SelectedVersesModalProps } from './types'

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
  const shortcuts: Partial<Record<SelectionShortcut | 'copy', (menu: SelectionMenu) => void>> = {
    note: onCreateNoteClick,
    tag: current => current.openScreen('tags'),
    link: onCreateLinkClick,
    bookmark: moreThanOneVerseSelected ? undefined : current => current.openScreen('bookmark'),
    focus: onPinVerses,
    references: moreThanOneVerseSelected ? undefined : onOpenReferences,
    compare: compareVerses,
    copy: copyToClipboard,
  }

  useEffect(() => {
    if (!isShown) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        clearSelectedVerses()
        return
      }
      if (!isOpen.current) return
      const command = event.metaKey || event.ctrlKey
      if (command && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c') {
        // Copying text the reader selected by hand keeps the browser's behaviour.
        if (!window.getSelection()?.isCollapsed || !shortcuts.copy) return
        event.preventDefault()
        shortcuts.copy(menu)
        return
      }
      if (command || event.altKey || event.repeat) return
      const action = (Object.keys(SELECTION_SHORTCUTS) as SelectionShortcut[]).find(
        name => SELECTION_SHORTCUTS[name] === event.key.toUpperCase()
      )
      const handler = action && shortcuts[action]
      if (!handler) return
      event.preventDefault()
      handler(menu)
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
      onPinVerses={onPinVerses}
      moreThanOneVerseSelected={moreThanOneVerseSelected}
      activeStates={activeStates}
    />,
    <StudyTab
      key="study"
      screenWidth={SELECTION_GROUP_WIDTH}
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
          className="w-[28px] h-[28px] items-center justify-center rounded-md"
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
