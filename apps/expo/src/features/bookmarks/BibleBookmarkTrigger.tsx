import type { ReactNode } from 'react'
import { TouchableBox } from '~common/ui/Box'
export type BibleBookmarkTriggerProps = {
  children: ReactNode
  book: number
  chapter: number
  version: string
  onPress: () => void
  accessibilityLabel: string
}
export default function BibleBookmarkTrigger({
  children,
  onPress,
  accessibilityLabel,
}: BibleBookmarkTriggerProps) {
  return (
    <TouchableBox
      className="items-center justify-center h-[100%]"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      {children}
    </TouchableBox>
  )
}
