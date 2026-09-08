import type { SheetProps, SheetRef } from '~common/sheet'
import type { Ref } from 'react'
import Box from '~common/ui/Box'
export default function InlineDisplayModeContent({
  children,
}: SheetProps & { ref?: Ref<SheetRef> }) {
  return <Box>{children}</Box>
}
