import BottomSheet from '@gorhom/bottom-sheet'
import { useCallback, useRef } from 'react'

export const useBottomSheet = () => {
  const ref = useRef<BottomSheet>(null)

  const close = useCallback(() => {
    ref.current?.close()
  }, [])

  const open = useCallback(() => {
    ref.current?.snapToIndex(0)
  }, [])

  return { ref, open, close }
}
