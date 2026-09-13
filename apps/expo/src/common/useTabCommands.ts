import { createContext, useContext, useEffect, useId, useRef } from 'react'
import { atom } from 'jotai/vanilla'
import { useSetAtom } from 'jotai/react'
import type { MenuAction } from './ui/MenuView'

export const TabCommandContext = createContext<string | undefined>(undefined)
export type TabCommand = {
  id: string
  title: string
  disabled?: boolean
  destructive?: boolean
  run: () => void
}
export const tabCommandsAtom = atom<Record<string, { tabId: string; commands: TabCommand[] }>>({})

export function flattenMenuActions(
  actions: MenuAction[],
  parent = '',
  disabled = false
): Omit<TabCommand, 'run'>[] {
  return actions
    .filter(action => !action.attributes?.hidden)
    .flatMap(action => {
      const title = parent && !action.displayInline ? `${parent} › ${action.title}` : action.title
      const isDisabled = disabled || !!action.attributes?.disabled
      return action.subactions
        ? flattenMenuActions(action.subactions, action.displayInline ? parent : title, isDisabled)
        : [
            {
              id: action.id ?? action.title,
              title,
              disabled: isDisabled,
              destructive: action.attributes?.destructive,
            },
          ]
    })
}

/** Menus opt in; cached surfaces retain their own commands, never the active tab's identity. */
export function useTabCommands(actions: MenuAction[] | undefined, run: (id: string) => void) {
  const tabId = useContext(TabCommandContext)
  const owner = useId()
  const setCommands = useSetAtom(tabCommandsAtom)
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  const enabled = actions !== undefined
  const serialized = JSON.stringify(flattenMenuActions(actions ?? []))
  useEffect(() => {
    if (!tabId || !enabled) return
    const commands: Omit<TabCommand, 'run'>[] = JSON.parse(serialized)
    setCommands(current => ({
      ...current,
      [owner]: {
        tabId,
        commands: commands.map(command => ({ ...command, run: () => runRef.current(command.id) })),
      },
    }))
    return () => {
      setCommands(current => {
        const next = { ...current }
        delete next[owner]
        return next
      })
    }
  }, [tabId, owner, serialized, enabled, setCommands])
}
