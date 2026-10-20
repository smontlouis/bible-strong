import { createContext, useContext } from 'react'

/**
 * Set inside the desktop selection menu: actions render as menu rows, and those with a form of
 * their own open it as a screen of the menu rather than as a popover of their own.
 */
export type SelectionMenu = {
  openScreen: (name: string) => void
}

export const SelectionMenuContext = createContext<SelectionMenu | null>(null)

export const useSelectionMenu = () => useContext(SelectionMenuContext)
