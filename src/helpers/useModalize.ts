import { useCallback, useRef } from 'react'
import { Modalize } from 'react-native-modalize'
import { TClose, TOpen } from 'react-native-modalize/lib/options'

export const useModalize = () => {
  const ref = useRef<Modalize>(null)

  const close = useCallback((dest?: TClose) => {
    ref.current?.close(dest)
  }, [])

  const open = useCallback((dest?: TOpen) => {
    ref.current?.open(dest)
  }, [])

  return { ref, open, close }
}
