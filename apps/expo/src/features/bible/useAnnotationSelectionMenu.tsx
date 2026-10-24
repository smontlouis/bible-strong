import { useSetAtom } from 'jotai/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ColorCircleGrid from '~common/ColorCircleGrid'
import type { PanelNavigation, PanelScreen } from '~common/ContextualPanel/types'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useColorItems } from '~helpers/useHighlightColors'
import { colorPickerModalAtom } from 'src/state/app'
import {
  AnnotationTypeSwitch,
  useAnnotationTools,
  type AnnotationToolbarProps,
} from './AnnotationControls'
import { AnnotationAnnotateTab, AnnotationShareTab, AnnotationStudyTab } from './AnnotationGroups'
import {
  BIBLE_SELECTION_MENU_WIDTH,
  type BibleSelectionMenuContent,
} from './bibleSelectionMenuContent'
import SelectionMenuTabs from './SelectedVersesModal/components/SelectionMenuTabs'
import { SELECTION_GROUP_WIDTH } from './SelectedVersesModal/selectionSheetLayout'
import {
  SelectionMenuContext,
  type SelectionMenu as SelectionMenuValue,
} from './SelectedVersesModal/selectionMenuContext'
import useAnnotationWordActions from './useAnnotationWordActions'
import useSelectionStrongWords from './useSelectionStrongWords'
import type { VerseMenuTarget } from './VerseMenu.web'
import { isEditingTarget } from '~features/keyboard-shortcuts/keyboardTargets'
import { findShortcut, matchShortcut } from '~features/keyboard-shortcuts/keymap'

/** Keys of the desktop annotation menu, shown beside each action. */
const ANNOTATION_SHORTCUTS = ['note', 'tags', 'relation', 'erase', 'focus', 'copy'] as const

// Its screens are named apart from those of the selected verses, which the menu showed before
const TAGS_SCREEN = 'annotation-tags'

type AnchorVerse = Omit<VerseMenuTarget, 'version'>

/**
 * The annotation tools in the desktop selection menu, beside the verse being annotated: the ways
 * to mark words, then the groups of the selected verses' menu, for words. They open at the verse
 * annotation mode started from, then follow the words the reader selects or the annotation they
 * open. The menu's own button ends the mode; Escape lets go of the selected words, then of the
 * selected annotation, then ends the mode.
 */
export default function useAnnotationSelectionMenu(
  props: Omit<AnnotationToolbarProps, 'ref'>,
  isShown: boolean
): BibleSelectionMenuContent {
  const {
    hasSelection,
    selection,
    onClearSelection,
    onClose,
    selectedAnnotation,
    onClearAnnotationSelection,
    onFocusVerses,
    tagsCount = 0,
    relationsCount = 0,
    annotatedVersion,
    entryVerseKey,
    isEnabled,
    verses = [],
  } = props
  const { t } = useTranslation()
  const colorItems = useColorItems()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)
  const navigation = useRef<PanelNavigation | null>(null)
  const isOpen = useRef(false)
  const menu: SelectionMenuValue = {
    openScreen: name => navigation.current?.open(name === 'tags' ? TAGS_SCREEN : name),
  }
  const tools = useAnnotationTools(props, { openTags: () => menu.openScreen('tags') })
  const strongWords = useSelectionStrongWords(annotatedVersion, tools.wordRanges, verses)
  const wordActions = useAnnotationWordActions(annotatedVersion, tools.wordRanges)
  const tags = useEntityTagsScreen('wordAnnotations', selectedAnnotation?.id ?? '')
  const hasWords = !tools.disabled && tools.wordRanges.length > 0

  // Each session opens on its annotation's tools
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  if (!isEnabled && activeTabIndex !== 0) setActiveTabIndex(0)

  // The menu stays by the last words or annotation chosen once they are let go of, until the mode
  // ends.
  const current: AnchorVerse | undefined = selectedAnnotation
    ? { verseKey: selectedAnnotation.verseKey }
    : selection
      ? { verseKey: selection.end.verseKey }
      : undefined
  const [lastAnchor, setLastAnchor] = useState<AnchorVerse | undefined>(current)
  if (current && current.verseKey !== lastAnchor?.verseKey) setLastAnchor(current)
  if (!isEnabled && lastAnchor) setLastAnchor(undefined)
  const anchor = current ?? lastAnchor ?? { verseKey: entryVerseKey }
  const target: VerseMenuTarget = {
    ...anchor,
    version: selection?.version ?? annotatedVersion ?? '',
  }

  // The tags screen belongs to one annotation: letting it go or choosing another one comes back to
  // the tools. Words just annotated open their new annotation's tags, if they were asked for.
  const previousAnnotationId = useRef(selectedAnnotation?.id)
  const backToTools = useEffectEvent(() => {
    navigation.current?.back()
    tags.reset()
  })
  useEffect(() => {
    if (previousAnnotationId.current) backToTools()
    previousAnnotationId.current = selectedAnnotation?.id
  }, [selectedAnnotation?.id])

  const focusWords = () => onFocusVerses?.(tools.verseKeys)

  useEffect(() => {
    if (!isShown) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditingTarget(event.target)) return
      if (matchShortcut(event, 'deselect')) {
        event.preventDefault()
        if (hasSelection) onClearSelection()
        else if (selectedAnnotation) onClearAnnotationSelection?.()
        else onClose()
        return
      }
      if (!isOpen.current || event.repeat) return
      const action = findShortcut(event, ANNOTATION_SHORTCUTS)
      const handler =
        action === 'erase'
          ? tools.erase
          : action === 'note' && !tools.noteDisabled
            ? tools.openNote
            : action === 'tags' && !tools.tagsDisabled
              ? tools.openTags
              : action === 'relation' && !tools.relationsDisabled
                ? tools.openRelations
                : action === 'focus' && hasWords && onFocusVerses
                  ? focusWords
                  : // Copying text the reader selected by hand keeps the browser's behaviour.
                    action === 'copy' && hasWords && window.getSelection()?.isCollapsed !== false
                    ? wordActions.copy
                    : undefined
      if (!handler) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const reference: string = tools.reference ?? t('Sélectionnez des mots')

  const tabs = [
    <AnnotationAnnotateTab
      key="annotate"
      screenWidth={SELECTION_GROUP_WIDTH}
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
      tagsNested
    />,
    <AnnotationStudyTab
      key="study"
      screenWidth={SELECTION_GROUP_WIDTH}
      hasFocus={tools.hasFocus}
      focusDisabled={!hasWords || !onFocusVerses}
      onFocus={focusWords}
      version={annotatedVersion}
      strongWords={tools.disabled ? { status: 'none' } : strongWords}
      onOpenWord={wordActions.openWord}
    />,
    <AnnotationShareTab
      key="share"
      screenWidth={SELECTION_GROUP_WIDTH}
      disabled={!hasWords}
      onCopy={wordActions.copy}
      onShare={wordActions.share}
    />,
  ]

  const screens: Record<string, PanelScreen> = {
    actions: {
      title: reference,
      titleAccessory: annotatedVersion ? (
        <Box
          className="rounded-full px-[6px] py-[1px] bg-light-grey shrink-0"
          testID="annotation-toolbar-version"
        >
          <Text className="text-[11px] font-bold text-link">{annotatedVersion}</Text>
        </Box>
      ) : undefined,
      width: BIBLE_SELECTION_MENU_WIDTH,
      headerRight: (
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('Fermer')}
          onPress={onClose}
          className="w-[28px] h-[28px] items-center justify-center rounded-full"
        >
          <FeatherIcon name="x" size={17} color="tertiary" />
        </TouchableBox>
      ),
      headerContent: (
        <>
          <HStack className="items-center gap-[8px] px-[10px] pt-[4px] pb-[6px]">
            <AnnotationTypeSwitch
              compact
              disabled={tools.disabled}
              activeType={tools.activeAnnotationType}
              onChange={tools.setActiveAnnotationType}
              getColor={tools.getColor}
            />
            <Box className="flex-1 min-w-0" style={{ opacity: tools.disabled ? 0.5 : 1 }}>
              <ColorCircleGrid
                colors={colorItems}
                selectedColor={tools.selectedColor}
                onSelect={colorKey =>
                  !tools.disabled && tools.apply(colorKey, tools.activeAnnotationType)
                }
                showAddButton
                onAddPress={() =>
                  setColorPickerModal({
                    selectedColor: tools.selectedColor,
                    onSelectColor: colorKey => tools.apply(colorKey, tools.activeAnnotationType),
                  })
                }
                layout="grid"
                circleSize={20}
              />
            </Box>
          </HStack>
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
            <Box className="w-full" testID="annotation-toolbar">
              {tabs[activeTabIndex] ?? tabs[0]}
            </Box>
          </SelectionMenuContext.Provider>
        )
      },
    },
    [TAGS_SCREEN]: {
      ...tags.screen,
      width: 320,
      headerContent: (
        <>
          <Text className="px-3 text-[12px] text-tertiary" numberOfLines={1}>
            {selectedAnnotation?.text ?? reference}
          </Text>
          {tags.screen.headerContent}
        </>
      ),
      // An annotation deleted from another device leaves nothing to tag.
      content: nav => (selectedAnnotation ? tags.screen.content(nav) : null),
    },
  }

  return {
    target,
    accessibilityLabel: t('Annotation'),
    screens,
    onOpenChange: open => {
      isOpen.current = open
      if (open) return
      navigation.current = null
      tags.reset()
    },
    // Escape inside the menu ends the mode, as its own button does.
    onClose,
  }
}
