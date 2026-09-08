import { createContext } from 'react'
import type { PanelNavigation } from './types'
export const PanelNavigationContext = createContext<PanelNavigation | null>(null)
