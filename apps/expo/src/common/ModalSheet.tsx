import type { Ref } from 'react'
import { Sheet, type SheetProps, type SheetRef } from './sheet'
export type ModalSheetProps = SheetProps & { ref?: Ref<SheetRef>; modalTitle?: string }
export default function ModalSheet({ modalTitle: _, ...props }: ModalSheetProps) {
  return <Sheet {...props} />
}
