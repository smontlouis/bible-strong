import BottomSheet, { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRef } from 'react'

export const useBottomSheet = () => {
  const ref = useRef<BottomSheet>(null)

  const close = () => {
    ref.current?.close()
  }

  const open = () => {
    ref.current?.snapToIndex(0)
  }

  return { ref, open, close }
}

export const useBottomSheetModal = () => {
  const ref = useRef<BottomSheetModal>(null)

  const close = () => {
    ref.current?.dismiss()
  }

  const open = () => {
    ref.current?.present()
  }

  return { ref, open, close }
}
