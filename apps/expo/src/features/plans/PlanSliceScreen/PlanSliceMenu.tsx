import type { ComponentProps } from 'react'
import { MenuView } from '~common/ui/MenuView'
import type { VersionCode } from '~state/tabs'

export type PlanSliceMenuProps = ComponentProps<typeof MenuView> & {
  version: VersionCode
  onVersionChange: (version: VersionCode) => void
}

export default function PlanSliceMenu({
  version: _,
  onVersionChange: __,
  ...props
}: PlanSliceMenuProps) {
  return <MenuView {...props} />
}
