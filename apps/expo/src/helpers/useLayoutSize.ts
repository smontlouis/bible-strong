import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { View } from 'react-native'

interface LayoutSize {
  width: number
  height: number
}

export function useLayoutSize() {
  const ref = useRef<View>(null)
  const [size, setSize] = useState<LayoutSize>({ width: 0, height: 0 })

  const measure = useCallback(() => {
    ref.current?.measure((x, y, width, height) => {
      setSize({ width, height })
    })
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  const onLayout = useCallback(() => {
    measure()
  }, [measure])

  return { ref, size, onLayout }
}
