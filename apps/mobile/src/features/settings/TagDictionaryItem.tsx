import type { TagsObj } from '~common/types'
import { DictionaryItemCard, type TagItemData } from './TagItemCard'

export type TagDictionaryItemData = TagItemData & {
  tags?: TagsObj
}

type Props = {
  item: TagDictionaryItemData
}

const TagDictionaryItem = ({ item }: Props) => <DictionaryItemCard item={item} />

export default TagDictionaryItem
