import BottomSheet, {
  type BottomSheet as BottomSheetRef,
  BottomSheetModal,
} from '~common/bottom-sheet'
import { useRef } from 'react'

export const useBottomSheet = () => {
  const ref = useRef<BottomSheetRef>(null)

  const close = () => {
    ref.current?.close()
  }

  const open = () => {
    ref.current?.snapToIndex(0)
  }

  return { ref, open, close, getRef: () => ref }
}

export const useBottomSheetModal = () => {
  const ref = useRef<BottomSheetModal>(null)

  const close = () => {
    ref.current?.dismiss()
  }

  const open = () => {
    ref.current?.present()
  }

  return { ref, open, close, getRef: () => ref }
}
