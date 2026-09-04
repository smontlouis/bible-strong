import { createContext, useContext } from 'react'

import type { CurrentTheme } from './types'

export type ThemeSelectionOverride = {
  colorScheme: 'light' | 'dark'
  theme: CurrentTheme
}

export const ThemeSelectionOverrideContext = createContext<ThemeSelectionOverride | undefined>(
  undefined
)

export const useThemeSelectionOverride = () => useContext(ThemeSelectionOverrideContext)
