import { useContext, useEffect } from 'react'
import { useAtomValue } from 'jotai/react'
import { usePathname } from 'expo-router'
import { TabCommandContext } from '~common/useTabCommands'
import { activeTabIdAtom, appSwitcherModeAtom } from '~state/tabs'
import { commandPaletteOpenAtom } from '~features/app-switcher/commandPalette/state'
import { isEditingTarget } from '~features/app-switcher/keyboardShortcuts'
import { isBibleShortcut } from './bibleKeyboardActions'

export function useBibleKeyboardShortcut(
  key: 'v' | 's',
  tabId: string,
  run: () => void,
  enabled = true
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
      if (!isBibleShortcut(event, key) || event.defaultPrevented || isEditingTarget(event.target))
        return
      if (
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [aria-modal="true"]'
        )
      )
        return
      event.preventDefault()
      event.stopPropagation()
      run()
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [active, paletteOpen, key, run])
  return active
}
