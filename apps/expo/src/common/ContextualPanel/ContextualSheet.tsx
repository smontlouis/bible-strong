import type { ReactNode, Ref } from 'react'
import { Sheet, type SheetProps, type SheetRef } from '~common/sheet'

export type ContextualSheetProps = SheetProps & {
  ref?: Ref<SheetRef>
  panelTitle?: string
  panelHeaderRight?: ReactNode
  panelHeaderContent?: ReactNode
  panelWidth?: number
}

// Opt-in adapter: native retains exactly the existing sheet.
export default function ContextualSheet({
  panelTitle: _,
  panelHeaderRight: __,
  panelHeaderContent: ___,
  panelWidth: ____,
  ...props
}: ContextualSheetProps) {
  return <Sheet {...props} />
}
