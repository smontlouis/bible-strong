import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'

import TagList from '~common/TagList'
import type { TagsObj } from '~common/types'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'

export type TagStrongItemData = {
  id: string
  title: string
  tags?: TagsObj
}

type Props = {
  item: TagStrongItemData
  variant: 'grec' | 'hebreu'
}

const TagStrongItem = ({ item, variant }: Props) => {
  const router = useRouter()
  const { t } = useTranslation()
  const isGrec = variant === 'grec'

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/strong',
          params: {
            book: isGrec ? '40' : '1',
            reference: item.id,
          },
        })
      }
    >
      <VStack gap={6} mx={20} paddingVertical={15} borderBottomWidth={1} borderColor="border">
        <HStack gap={10} alignItems="center">
          <Text fontSize={14} bold>
            {item.title}
          </Text>
          <Box
            backgroundColor={isGrec ? 'primary' : 'quart'}
            paddingHorizontal={8}
            paddingVertical={3}
            rounded
          >
            <Text fontSize={10} color="reverse" bold>
              {item.id} - {isGrec ? t('Grec') : t('Hébreu')}
            </Text>
          </Box>
        </HStack>
      </VStack>
    </TouchableOpacity>
  )
}

export default TagStrongItem
