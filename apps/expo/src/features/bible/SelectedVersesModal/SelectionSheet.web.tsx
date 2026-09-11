import { useContext, useLayoutEffect, useState, type Ref } from 'react'
import { Sheet, type SheetProps, type SheetRef } from '~common/sheet'
import { BibleViewportContext } from '../BibleViewport.web'
import { getSelectionSheetMaxWidth } from './selectionSheetLayout'
import { getSelectionSheetBounds } from './selectionSheetBounds'

export default function SelectionSheet({
  ref,
  onPresent,
  onDismiss,
  ...props
}: SheetProps & { ref?: Ref<SheetRef> }) {
  const viewport = useContext(BibleViewportContext)
  const [active, setActive] = useState(false)
  const [bounds, setBounds] = useState<SheetProps['webContainerBounds']>()
  useLayoutEffect(() => {
    if (!active || !viewport) return
    let frame = 0
    const measure = () => {
      const rect = viewport.current?.getBoundingClientRect()
      if (rect) {
        const next = getSelectionSheetBounds(rect, window.innerWidth, window.innerHeight)
        setBounds(previous =>
          previous &&
          Object.keys(next).every(
            key =>
              Math.abs(previous[key as keyof typeof next] - next[key as keyof typeof next]) < 0.5
          )
            ? previous
            : next
        )
      }
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [active, viewport])
  return (
    <Sheet
      {...props}
      ref={ref}
      maxWidth={getSelectionSheetMaxWidth(bounds?.width ?? 400)}
      webContainerBounds={bounds}
      onPresent={() => {
        setActive(true)
        onPresent?.()
      }}
      onDismiss={() => {
        setActive(false)
        onDismiss?.()
      }}
    />
  )
}
