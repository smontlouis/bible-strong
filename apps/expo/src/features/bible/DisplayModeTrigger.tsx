import type { ComponentProps } from 'react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import type { BibleTab } from '~state/tabs'
import { AnimatedTouchableBox, TouchableBox } from '~common/ui/Box'
export type DisplayModeTriggerProps = Omit<ComponentProps<typeof TouchableBox>, 'style'> & {
  style?: ComponentProps<typeof AnimatedTouchableBox>['style']
  kind: 'strong' | 'interlinear'
  bibleAtom: PrimitiveAtom<BibleTab>
}
export default function DisplayModeTrigger({
  kind: _kind,
  bibleAtom: _atom,
  ...props
}: DisplayModeTriggerProps) {
  return <AnimatedTouchableBox {...props} />
}
