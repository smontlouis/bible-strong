import type { PrimitiveAtom } from 'jotai/vanilla'
import type { TabItem } from '~state/tabs'
import { useSetAtom } from 'jotai/react'
import { commandPaletteOpenAtom, commandPaletteScopeAtom, commandPaletteTargetAtom } from './state'
import { paletteScopes } from './scopes'

export function useLaunchSearch() {
  const setOpen = useSetAtom(commandPaletteOpenAtom)
  const setScope = useSetAtom(commandPaletteScopeAtom)
  const setTarget = useSetAtom(commandPaletteTargetAtom)
  return (type?: string, target?: PrimitiveAtom<TabItem>) => {
    if (type && !paletteScopes.some(scope => scope.type === type)) return false
    setTarget(target)
    setScope(type)
    setOpen(true)
    return true
  }
}
