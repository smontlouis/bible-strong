import type { TagsObj } from '~common/types'
import { StrongItemCard, type TagItemData } from './TagItemCard'

export type TagStrongItemData = TagItemData & {
  tags?: TagsObj
}

type Props = {
  item: TagStrongItemData
  variant: 'grec' | 'hebreu'
}

const TagStrongItem = ({ item, variant }: Props) => <StrongItemCard item={item} variant={variant} />

export default TagStrongItem
