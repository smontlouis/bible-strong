import type { ReactNode, Ref, RefObject } from 'react'
export type PanelNavigation = {
  open: (screen: string) => void
  back: () => void
  close: () => void
  openScreen?: (screen: PanelScreen) => void
}
export type PanelScreen = {
  title: string
  /** Optional web width for this screen; height follows its content. */
  width?: number
  onEnter?: () => void
  content: (navigation: PanelNavigation) => ReactNode
  headerRight?: ReactNode
  headerContent?: ReactNode
  footer?: ReactNode
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
  /** Web adapter for existing imperative launchers. */
  controllerRef?: Ref<{ present: () => void; dismiss: () => void }>
  anchorRef?: RefObject<HTMLElement | null>
}
