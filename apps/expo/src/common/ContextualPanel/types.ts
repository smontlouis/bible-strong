import type { MenuAction } from '~common/ui/MenuView'
import type { ReactNode, Ref, RefObject } from 'react'
export type PanelNavigation = {
  open: (screen: string) => void
  back: () => void
  close: () => void
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
