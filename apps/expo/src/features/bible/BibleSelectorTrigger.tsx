import type { ComponentProps } from 'react'
import { TouchableBox } from '~common/ui/Box'
import type { BibleTab, BibleTabActions } from '~state/tabs'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
export type BibleSelectorTriggerProps = ComponentProps<typeof TouchableBox> & {
  kind: 'book' | 'version'
  data: BibleTab['data']
  actions: BibleTabActions
  coverage?: BibleVersionCoverage
}
export default function BibleSelectorTrigger({
  kind: _kind,
  data: _data,
  actions: _actions,
  coverage: _coverage,
  ...props
}: BibleSelectorTriggerProps) {
  return <TouchableBox {...props} />
}
