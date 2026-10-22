import { useContext, useEffect } from 'react'
import { useAtomValue } from 'jotai/react'
import { usePathname } from 'expo-router'
import { TabCommandContext } from '~common/useTabCommands'
import { activeTabIdAtom, appSwitcherModeAtom } from '~state/tabs'
import { commandPaletteOpenAtom } from '~features/app-switcher/commandPalette/state'
import {
  isBlockingOverlayOpen,
  isEditingTarget,
  isPassthroughPanelOpen,
} from '~features/keyboard-shortcuts/keyboardTargets'
import { matchShortcut, type ShortcutId } from '~features/keyboard-shortcuts/keymap'
import type { BibleKeyboardShortcutOptions } from './useBibleKeyboardShortcut'

export function useBibleKeyboardShortcut(
  shortcut: ShortcutId,
  tabId: string,
  run: () => void,
  { enabled = true, repeat = false, besideVerseMenu = false }: BibleKeyboardShortcutOptions = {}
) {
  const ownerId = useContext(TabCommandContext)
  const activeId = useAtomValue(activeTabIdAtom)
  const mode = useAtomValue(appSwitcherModeAtom)
  const paletteOpen = useAtomValue(commandPaletteOpenAtom)
  const pathname = usePathname()
  const active =
    enabled && ownerId === tabId && activeId === tabId && pathname === '/' && mode === 'view'
  useEffect(() => {
    if (!active || paletteOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (
        !matchShortcut(event, shortcut) ||
        (event.repeat && !repeat) ||
        event.defaultPrevented ||
        isEditingTarget(event.target) ||
        isBlockingOverlayOpen() ||
        (!besideVerseMenu && isPassthroughPanelOpen())
      )
        return
      event.preventDefault()
      event.stopPropagation()
      run()
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [active, paletteOpen, shortcut, repeat, besideVerseMenu, run])
  return active
}
