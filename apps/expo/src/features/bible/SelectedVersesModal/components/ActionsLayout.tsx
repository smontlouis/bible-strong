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
      // Centred when every action fits (a wide iPad sheet); scrolls from the left edge otherwise.
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 }}
      style={{ width }}
    >
      {children}
    </ScrollView>
  )
}
