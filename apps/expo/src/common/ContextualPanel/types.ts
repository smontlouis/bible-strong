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
  headerContent?: ReactNode
}
export type ContextualPanelProps = {
  trigger: ReactNode
  triggerSize?: number
  accessibilityLabel: string
  screens: Record<string, PanelScreen>
  initialScreen: string
  width?: number
  onClose?: () => void
  onOpen?: () => void
}
