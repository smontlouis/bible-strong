import type { MenuAction } from '~common/ui/MenuView'
import type { ReactNode, Ref, RefObject } from 'react'
export type PanelNavigation = {
  open: (screen: string) => void
  back: () => void
  close: () => void
  /**
   * Closes the panel, then runs `action` once it is gone. Use it for an action that presents
   * another screen (a route, a tab): on iOS the native sheet must be off screen first.
   */
  closeThen: (action: () => void) => void
  openScreen?: (screen: PanelScreen) => void
}
export type PanelScreen = {
  title: string
  hideHeader?: boolean
  /** Optional web width for this screen; height follows its content. */
  width?: number
  onEnter?: () => void
  content: (navigation: PanelNavigation) => ReactNode
  headerLeft?: ReactNode
  headerRight?: ReactNode
  headerContent?: ReactNode
  footer?: ReactNode
}
export type ContextualPanelProps = {
  commands?: { actions: MenuAction[]; select: (id: string, navigation: PanelNavigation) => void }
  trigger: ReactNode
  triggerSize?: number
  accessibilityLabel: string
  screens: Record<string, PanelScreen>
  initialScreen: string
  /** Screens the panel opens on, the last one shown: back leads through the others. */
  initialStack?: string[]
  width?: number
  onClose?: () => void
  onOpen?: () => void
  /** Web adapter for existing imperative launchers. */
  controllerRef?: Ref<PanelController>
  anchorRef?: RefObject<HTMLElement | null>
  /** Web: side of the anchor the popover opens on (default bottom). */
  placement?: PanelPlacement
  /** Web: open on that side even when it lacks room, rather than flipping to the other. */
  noFlip?: boolean
  /** Web: the page stays usable while the panel is open; only the panel closes itself. */
  nonModal?: boolean
}
export type PanelController = {
  /** Toggles the panel. */
  present: () => void
  dismiss: () => void
  /** Opens the panel, or leaves it open. */
  open?: () => void
}
export type PanelPlacement =
  | 'bottom'
  | 'bottom start'
  | 'top'
  | 'top start'
  | 'right top'
  | 'left top'
