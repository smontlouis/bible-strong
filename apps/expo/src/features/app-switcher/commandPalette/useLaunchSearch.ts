import { useSetAtom } from 'jotai/react'
import { commandPaletteOpenAtom, commandPaletteScopeAtom } from './state'
import { paletteScopes } from './scopes'

export function useLaunchSearch() {
  const setOpen = useSetAtom(commandPaletteOpenAtom)
  const setScope = useSetAtom(commandPaletteScopeAtom)
  return (type?: string) => {
    if (type && !paletteScopes.some(scope => scope.type === type)) return false
    setScope(type)
    setOpen(true)
    return true
  }
}
