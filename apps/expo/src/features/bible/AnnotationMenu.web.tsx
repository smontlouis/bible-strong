import { useSetAtom } from 'jotai/react'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ColorCircleGrid from '~common/ColorCircleGrid'
import type { PanelNavigation, PanelScreen } from '~common/ContextualPanel/types'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import type { SheetRef } from '~common/sheet'
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
import ActionItem from './SelectedVersesModal/components/ActionItem'
import {
  SelectionMenuContext,
  type SelectionMenu as SelectionMenuValue,
} from './SelectedVersesModal/selectionMenuContext'
import VerseMenu, { isEditableTarget, type VerseMenuTarget } from './VerseMenu.web'

const ANNOTATION_MENU_WIDTH = 288

/** Keys of the desktop free mode menu, shown beside each action. */
const ANNOTATION_SHORTCUTS = { note: 'N', tags: 'T', relations: 'R' } as const

type AnchorVerse = Omit<VerseMenuTarget, 'version'>

/**
 * The desktop form of the free mode sheet: a menu beside the verse being annotated (see
 * VerseMenu). It opens with the mode, at the verse the mode started from, then follows the words
 * the reader selects or the annotation they open. Its own button ends the mode; Escape lets go
 * of the selected words, then of the selected annotation, then ends the mode.
 */
export default function AnnotationMenu(props: AnnotationToolbarProps) {
  const {
    ref,
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
    version,
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
  const [isOpen, setOpen] = useState(false)
  const [isRequested, setRequested] = useState(false)
  const tags = useEntityTagsScreen('wordAnnotations', selectedAnnotation?.id ?? '')

  // The menu stays by the last words or annotation chosen once they are let go of.
  const current: AnchorVerse | undefined = selectedAnnotation
    ? { verseKey: selectedAnnotation.verseKey }
    : selection
      ? { verseKey: selection.end.verseKey }
      : undefined
  const [lastAnchor, setLastAnchor] = useState<AnchorVerse | undefined>(current)
  if (current && current.verseKey !== lastAnchor?.verseKey) setLastAnchor(current)
  const anchor = current ?? lastAnchor ?? { verseKey: entryVerseKey }
  const target: VerseMenuTarget = {
    ...anchor,
    version: selection?.version ?? annotatedVersion ?? version ?? '',
  }

  const menu: SelectionMenuValue = {
    openScreen: name => navigation.current?.open(name),
  }

  useImperativeHandle(ref, (): SheetRef => {
    const present = () => setRequested(true)
    const dismiss = () => {
      setRequested(false)
      setLastAnchor(undefined)
    }
    return {
      present,
      presentAt: present,
      resizeTo: () => {},
      dismiss,
      dismissThen: action => {
        dismiss()
        action()
      },
      close: dismiss,
      forceClose: dismiss,
    }
  })

  // A session started before the window grew to the desktop width opens the menu at once.
  useEffect(() => {
    if (isEnabled) setRequested(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The tags screen belongs to one annotation: choosing another one comes back to the tools.
  useEffect(() => {
    navigation.current?.back()
    tags.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnnotation?.id])

  const erase = selectedAnnotation
    ? onDeleteAnnotation
    : hasSelection
      ? onEraseAnnotations
      : undefined

  useEffect(() => {
    if (!isRequested) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (hasSelection) onClearSelection()
        else if (selectedAnnotation) onClearAnnotationSelection?.()
        else onClose()
        return
      }
      if (!isOpen || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
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
      width: ANNOTATION_MENU_WIDTH,
      headerRight: (
        <>
          {erase && (
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel={t('Supprimer')}
              disabled={!isEnabled}
              onPress={erase}
              className="w-[28px] h-[28px] items-center justify-center rounded-md"
            >
              <FeatherIcon name="trash-2" size={16} color="quart" />
            </TouchableBox>
          )}
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={t('Fermer')}
            onPress={onClose}
            className="w-[28px] h-[28px] items-center justify-center rounded-md"
          >
            <FeatherIcon name="x" size={17} color="tertiary" />
          </TouchableBox>
        </>
      ),
      headerContent: (
        <HStack className="px-3 pb-[6px] items-center gap-[6px]">
          {version && (
            <Box
              className="rounded-[5px] px-[5px] py-[1px] bg-light-grey"
              testID="annotation-toolbar-version"
            >
              <Text className="text-[11px] font-bold text-primary">{version}</Text>
            </Box>
          )}
          <Text className="flex-1 text-[12px] text-tertiary" numberOfLines={2}>
            {reference}
          </Text>
        </HStack>
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
                  gridAlign="start"
                  circleSize={22}
                />
              </Box>
              <Box className="h-px bg-border" />
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
    tags: {
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

  return (
    <VerseMenu
      isRequested={isRequested}
      target={target}
      accessibilityLabel={t('Annotation')}
      initialScreen="actions"
      width={ANNOTATION_MENU_WIDTH}
      screens={screens}
      onOpenChange={open => {
        setOpen(open)
        if (open) return
        navigation.current = null
        tags.reset()
      }}
      // Escape inside the menu ends the mode, as its own button does.
      onClose={onClose}
    />
  )
}
