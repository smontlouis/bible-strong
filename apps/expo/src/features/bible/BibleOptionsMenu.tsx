import { MenuView } from '~common/ui/MenuView'
import type { ComponentProps } from 'react'
type Props = ComponentProps<typeof MenuView> & {
  bookNumber: number
  chapter: number
  version: string
}
export default function BibleOptionsMenu({
  bookNumber: _book,
  chapter: _chapter,
  version: _version,
  ...props
}: Props) {
  return <MenuView {...props} />
}
