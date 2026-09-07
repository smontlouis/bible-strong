import type { ReactNode } from 'react'
export type PanelNavigation = {
  open: (screen: string) => void
  back: () => void
  close: () => void
}
export type PanelScreen = {
  title: string
  content: (navigation: PanelNavigation) => ReactNode
  headerRight?: ReactNode
}
export type ContextualPanelProps = {
  trigger: ReactNode
  accessibilityLabel: string
  screens: Record<string, PanelScreen>
  initialScreen: string
  width?: number
  onClose?: () => void
}
