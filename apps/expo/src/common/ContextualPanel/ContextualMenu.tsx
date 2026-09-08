import type { ComponentProps } from 'react'
import { MenuView } from '~common/ui/MenuView'
import type { FeatherIcon } from '~common/ui/Icon'
import type { PanelScreen } from './types'

export type ContextualMenuProps = ComponentProps<typeof MenuView> & {
  screens: Record<string, PanelScreen>
  panelTitle: string
  panelWidth?: number
  icons?: Record<string, ComponentProps<typeof FeatherIcon>['name']>
  onPanelClose?: () => void
}

export default function ContextualMenu({
  screens: _,
  panelTitle: __,
  panelWidth: ___,
  icons: ____,
  onPanelClose: _____,
  ...props
}: ContextualMenuProps) {
  return <MenuView {...props} />
}
