import { createContext, useRef, type ComponentProps, type RefObject } from 'react'
import Box from '~common/ui/Box'

export const BibleViewportContext = createContext<RefObject<HTMLElement | null> | null>(null)

export default function BibleViewport(props: ComponentProps<typeof Box>) {
  const element = useRef<HTMLElement | null>(null)
  return (
    <BibleViewportContext.Provider value={element}>
      <Box
        {...props}
        ref={node => {
          element.current = node as unknown as HTMLElement | null
        }}
        testID="bible-selection-viewport"
      />
    </BibleViewportContext.Provider>
  )
}
