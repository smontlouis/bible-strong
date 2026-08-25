import type { TagsObj } from '~common/types'
import { NaveItemCard, type TagItemData } from './TagItemCard'

export type TagNaveItemData = TagItemData & {
  tags?: TagsObj
}

type Props = {
  item: TagNaveItemData
}

const TagNaveItem = ({ item }: Props) => <NaveItemCard item={item} />

export default TagNaveItem
