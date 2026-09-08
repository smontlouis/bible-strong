import type { ComponentProps } from 'react'
import { TouchableBox } from '~common/ui/Box'
import type { VersionCode } from '~state/tabs'
export type RelationVersionButtonProps = ComponentProps<typeof TouchableBox> & {
  version: VersionCode
  onVersionChange: (version: VersionCode) => void
}
export default function RelationVersionButton({
  version: _,
  onVersionChange: __,
  ...props
}: RelationVersionButtonProps) {
  return <TouchableBox {...props} />
}
