import type { ReactNode } from 'react'
import { ScrollView } from 'react-native'

export interface ActionsLayoutProps {
  children: ReactNode
  width: number
}

export default function ActionsLayout({ children, width }: ActionsLayoutProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      style={{ width }}
    >
      {children}
    </ScrollView>
  )
}
