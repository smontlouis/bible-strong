import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'

import type { TagsObj } from '~common/types'
import { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'

export type TagDictionaryItemData = {
  id: string
  title: string
  tags?: TagsObj
}

type Props = {
  item: TagDictionaryItemData
}

const TagDictionaryItem = ({ item }: Props) => {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/dictionnary-detail',
          params: {
            word: item.title,
          },
        })
      }
    >
      <VStack gap={0} mx={20} paddingVertical={15} borderBottomWidth={1} borderColor="border">
        <HStack gap={10} alignItems="center">
          <Text fontSize={14} bold>
            {item.title}
          </Text>
        </HStack>
      </VStack>
    </TouchableOpacity>
  )
}

export default TagDictionaryItem
