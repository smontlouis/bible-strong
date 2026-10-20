import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelNavigation, PanelScreen } from '~common/ContextualPanel/types'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import type { SheetRef } from '~common/sheet'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBibleBookmarkScreens } from '~features/bookmarks/useBibleBookmarkScreens'
import { useAddToStudyScreens } from '~features/studies/useAddToStudyScreens'
import { getSelectedVersesBookmarkLocation } from '../selectedVersesActions'
import VerseMenu, { isEditableTarget } from '../VerseMenu.web'
import {
  SelectionMenuContext,
  type SelectionMenu as SelectionMenuValue,
} from './selectionMenuContext'
import { SELECTION_SHORTCUTS, type SelectionShortcut } from './selectionShortcuts'
import type { SelectionMenuProps } from './SelectionMenu'

export const SELECTION_MENU_WIDTH = 288

/**
 * The desktop form of the selected verses sheet: a menu of the same three groups, opened beside
 * the last verse selected (see VerseMenu). It stays open while the reader adds or removes verses.
 * Its own button and Escape end the selection.
 */
export default function SelectionMenu({
  ref,
  reference,
  selectedVerses,
  version,
  header,
  children,
  shortcuts,
  onSelectStudy,
  onClose,
}: SelectionMenuProps) {
  const { t } = useTranslation()
  const navigation = useRef<PanelNavigation | null>(null)
  const [isOpen, setOpen] = useState(false)
  const [isRequested, setRequested] = useState(false)

  const tags = useEntityTagsScreen('highlights', selectedVerses)
  const location = getSelectedVersesBookmarkLocation(selectedVerses)
  const bookmark = useBibleBookmarkScreens(
    location?.book ?? 1,
    location?.chapter ?? 1,
    version,
    location?.verse
  )
  const study = useAddToStudyScreens({ onSelect: onSelectStudy, reference })

  const menu: SelectionMenuValue = {
    openScreen: name => navigation.current?.open(name),
  }

  // The reader presents the menu at each change of the selection and dismisses it once empty.
  useImperativeHandle(ref, (): SheetRef => {
    const present = () => {
      setRequested(true)
    }
    const dismiss = () => setRequested(false)
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

  // A selection made before the window grew to the desktop width opens the menu at once.
  useEffect(() => {
    if (Object.keys(selectedVerses).length) setRequested(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isRequested) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (!isOpen) return
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

  const screens: Record<string, PanelScreen> = {
    actions: {
      title: reference,
      width: SELECTION_MENU_WIDTH,
      headerRight: (
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('Désélectionner')}
          onPress={onClose}
          className="w-[28px] h-[28px] items-center justify-center rounded-md"
        >
          <FeatherIcon name="x" size={17} color="tertiary" />
        </TouchableBox>
      ),
      headerContent: header,
      content: nav => {
        navigation.current = nav
        return (
          <SelectionMenuContext.Provider value={menu}>{children}</SelectionMenuContext.Provider>
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

  return (
    <VerseMenu
      isRequested={isRequested}
      target={{ verseKey: verseKeys[verseKeys.length - 1], version }}
      accessibilityLabel={reference}
      initialScreen="actions"
      width={SELECTION_MENU_WIDTH}
      screens={screens}
      onOpenChange={open => {
        setOpen(open)
        if (open) return
        navigation.current = null
        tags.reset()
        study.reset()
      }}
      // Escape inside the menu, or a screen that finished its task, ends the selection.
      onClose={onClose}
    />
  )
}
