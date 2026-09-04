import { type SheetRef } from '~common/sheet'
import { useRef } from 'react'

export const useSheet = () => {
  const ref = useRef<SheetRef>(null)

  const close = () => {
    ref.current?.dismiss()
  }

  const open = () => {
    ref.current?.present()
  }

  return { ref, open, close, getRef: () => ref }
}
