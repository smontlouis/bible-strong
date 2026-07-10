import React, { PropsWithChildren, ReactNode } from 'react'
import { ScrollView } from 'react-native'

import Box from '~common/ui/Box'

type StrongVersePreviewProps = PropsWithChildren<{
  footer: ReactNode
  height: number
}>

const StrongVersePreview = ({ children, footer, height }: StrongVersePreviewProps) => (
  <Box height={height} position="relative" zIndex={1}>
    <ScrollView contentContainerStyle={{ paddingTop: 10 }} nestedScrollEnabled style={{ flex: 1 }}>
      {children}
    </ScrollView>
    {footer}
  </Box>
)

export default StrongVersePreview
