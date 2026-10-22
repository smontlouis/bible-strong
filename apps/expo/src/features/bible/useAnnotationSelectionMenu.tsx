import { useSetAtom } from 'jotai/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import ColorCircleGrid from '~common/ColorCircleGrid'
import type { PanelNavigation, PanelScreen } from '~common/ContextualPanel/types'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useColorItems } from '~helpers/useHighlightColors'
import { colorPickerModalAtom } from 'src/state/app'
import {
  AnnotationTypeButton,
  useAnnotationTools,
  useAnnotationTypeLabels,
  type AnnotationToolbarProps,
} from './AnnotationControls'
import AnnotationPreview from './AnnotationPreview'
import {
  BIBLE_SELECTION_MENU_WIDTH,
  type BibleSelectionMenuContent,
} from './bibleSelectionMenuContent'
import ActionItem from './SelectedVersesModal/components/ActionItem'
import {
  SelectionMenuContext,
  type SelectionMenu as SelectionMenuValue,
} from './SelectedVersesModal/selectionMenuContext'
import { isEditableTarget, type VerseMenuTarget } from './VerseMenu.web'

/** Keys of the desktop annotation menu, shown beside each action. */
const ANNOTATION_SHORTCUTS = { note: 'N', tags: 'T', relations: 'R' } as const

// Its screens are named apart from those of the selected verses, which the menu showed before
const TAGS_SCREEN = 'annotation-tags'

type AnchorVerse = Omit<VerseMenuTarget, 'version'>

/**
 * The annotation tools in the desktop selection menu, beside the verse being annotated. They open
 * at the verse annotation mode started from, then follow the words the reader selects or the
 * annotation they open. The menu's own button ends the mode; Escape lets go of the selected words,
 * then of the selected annotation, then ends the mode.
 */
export default function useAnnotationSelectionMenu(
  props: Omit<AnnotationToolbarProps, 'ref'>,
  isShown: boolean
): BibleSelectionMenuContent {
  const {
    hasSelection,
    selection,
    onEraseAnnotations,
    onClearSelection,
    onClose,
    selectedAnnotation,
    onDeleteAnnotation,
    onClearAnnotationSelection,
    onNotePress,
    onRelationsPress,
    tagsCount = 0,
    relationsCount = 0,
    annotatedVersion,
    entryVerseKey,
    isEnabled,
  } = props
  const { t } = useTranslation()
  const typeLabels = useAnnotationTypeLabels()
  const colorItems = useColorItems()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)
  const tools = useAnnotationTools(props)
  const navigation = useRef<PanelNavigation | null>(null)
  const isOpen = useRef(false)
  const tags = useEntityTagsScreen('wordAnnotations', selectedAnnotation?.id ?? '')

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

  const menu: SelectionMenuValue = {
    openScreen: name => navigation.current?.open(name === 'tags' ? TAGS_SCREEN : name),
  }

  // The tags screen belongs to one annotation: choosing another one comes back to the tools.
  const backToTools = useEffectEvent(() => {
    navigation.current?.back()
    tags.reset()
  })
  useEffect(() => {
    backToTools()
  }, [selectedAnnotation?.id])

  const erase = selectedAnnotation
    ? onDeleteAnnotation
    : hasSelection
      ? onEraseAnnotations
      : undefined

  useEffect(() => {
    if (!isShown) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (hasSelection) onClearSelection()
        else if (selectedAnnotation) onClearAnnotationSelection?.()
        else onClose()
        return
      }
      if (!isOpen.current || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!erase || !isEnabled) return
        event.preventDefault()
        erase()
        return
      }
      const key = event.key.toUpperCase()
      const handler =
        key === ANNOTATION_SHORTCUTS.note && !tools.noteDisabled
          ? onNotePress
          : key === ANNOTATION_SHORTCUTS.tags && !tools.tagsDisabled
            ? () => menu.openScreen('tags')
            : key === ANNOTATION_SHORTCUTS.relations && !tools.relationsDisabled
              ? onRelationsPress
              : undefined
      if (!handler) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const reference = tools.reference ?? t('Sélectionnez du texte dans la Bible')
  const withCount = (label: string, count: number) => (count > 0 ? `${label} · ${count}` : label)

  const screens: Record<string, PanelScreen> = {
    actions: {
      title: t('Annotation'),
      titleAccessory: annotatedVersion ? (
        <Box
          className="rounded-full px-[6px] py-[1px] bg-light-grey shrink-0"
          testID="annotation-toolbar-version"
        >
          <Text className="text-[11px] font-bold text-primary">{annotatedVersion}</Text>
        </Box>
      ) : undefined,
      width: BIBLE_SELECTION_MENU_WIDTH,
      headerRight: (
        <>
          {erase && (
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel={t('Supprimer')}
              disabled={!isEnabled}
              onPress={erase}
              className="w-[28px] h-[28px] items-center justify-center rounded-full"
            >
              <FeatherIcon name="trash-2" size={16} color="quart" />
            </TouchableBox>
          )}
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={t('Fermer')}
            onPress={onClose}
            className="w-[28px] h-[28px] items-center justify-center rounded-full"
          >
            <FeatherIcon name="x" size={17} color="tertiary" />
          </TouchableBox>
        </>
      ),
      headerContent: (
        <Text className="px-3 pb-[6px] text-[12px] text-tertiary" numberOfLines={2}>
          {reference}
        </Text>
      ),
      content: nav => {
        navigation.current = nav
        return (
          <SelectionMenuContext.Provider value={menu}>
            <Box className="w-full gap-[10px]" testID="annotation-toolbar">
              <HStack className="gap-[6px]">
                {typeLabels.map(({ type, label }) => (
                  <AnnotationTypeButton
                    key={type}
                    compact
                    disabled={tools.disabled}
                    type={type}
                    activeType={tools.activeAnnotationType}
                    onPress={tools.setActiveAnnotationType}
                    label={label}
                  >
                    <AnnotationPreview type={type} color={tools.getColor(type)} />
                  </AnnotationTypeButton>
                ))}
              </HStack>
              <Box className="px-[4px]">
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
                  layout="grid"
                  circleSize={22}
                />
              </Box>
              <Box className="bg-separator" style={{ height: StyleSheet.hairlineWidth }} />
              <Box className="w-full gap-[2px]">
                <ActionItem
                  name={selectedAnnotation?.noteId ? 'file-text' : 'file-plus'}
                  label={t('Note')}
                  onPress={() => onNotePress?.()}
                  disabled={tools.noteDisabled}
                  isActive={!!selectedAnnotation?.noteId}
                  shortcut={ANNOTATION_SHORTCUTS.note}
                />
                <ActionItem
                  name="tag"
                  label={withCount(t('Étiquettes'), tagsCount)}
                  onPress={() => menu.openScreen('tags')}
                  disabled={tools.tagsDisabled}
                  isActive={tagsCount > 0}
                  shortcut={ANNOTATION_SHORTCUTS.tags}
                  nested
                />
                <ActionItem
                  name="git-merge"
                  label={withCount(t('Relations'), relationsCount)}
                  onPress={() => onRelationsPress?.()}
                  disabled={tools.relationsDisabled}
                  isActive={relationsCount > 0}
                  shortcut={ANNOTATION_SHORTCUTS.relations}
                />
              </Box>
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
