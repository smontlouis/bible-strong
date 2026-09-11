import type { PropsWithChildren } from 'react'
import Box from '~common/ui/Box'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'

export default function SelectionGroups({ children }: PropsWithChildren) {
  return (
    <Box className="mx-[16px]">
      <HorizontalControlScrollView horizontal showsHorizontalScrollIndicator={false}>
        {children}
      </HorizontalControlScrollView>
    </Box>
  )
}
