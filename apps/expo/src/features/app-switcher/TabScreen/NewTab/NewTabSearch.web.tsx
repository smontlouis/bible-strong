import { usePathname } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect } from 'react'
import { activeTabIdAtom, appSwitcherModeAtom, type TabItem } from '~state/tabs'
import CommandPalette from '../../commandPalette/CommandPalette.web'

export default function NewTabSearch({
  tabAtom,
  onPlanPress,
}: {
  tabAtom: PrimitiveAtom<TabItem>
  onPlanPress?: () => void
}) {
  const tab = useAtomValue(tabAtom)
  const activeId = useAtomValue(activeTabIdAtom)
  const mode = useAtomValue(appSwitcherModeAtom)
  const pathname = usePathname()
  const isActive = activeId === tab.id && mode === 'view' && pathname === '/'
  const inputId = `command-search-${tab.id}`
  useEffect(() => {
    if (!isActive) return
    const frame = requestAnimationFrame(() =>
      document.getElementById(inputId)?.querySelector('input')?.focus()
    )
    return () => cancelAnimationFrame(frame)
  }, [isActive, inputId])
  return <CommandPalette tabAtom={tabAtom} inputId={inputId} onPlanPress={onPlanPress} />
}
