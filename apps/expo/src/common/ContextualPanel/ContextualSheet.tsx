import type { ReactNode, Ref } from 'react'
import { Sheet, type SheetProps, type SheetRef } from '~common/sheet'
import type { PanelScreen } from './types'

export type ContextualSheetProps = SheetProps & {
  ref?: Ref<SheetRef>
  panelTitle?: string
  panelHeaderRight?: ReactNode
  panelHeaderContent?: ReactNode
  panelWidth?: number
  panelScreens?: Record<string, PanelScreen>
  panelInitialScreen?: string
}

// Opt-in adapter: native retains exactly the existing sheet.
export default function ContextualSheet({
  panelTitle: _,
  panelHeaderRight: __,
  panelHeaderContent: ___,
  panelWidth: ____,
  panelScreens: _____,
  panelInitialScreen: ______,
  ...props
}: ContextualSheetProps) {
  return <Sheet {...props} />
}
