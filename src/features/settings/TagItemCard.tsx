import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import type { ReactNode } from 'react'

import type { TagsObj } from '~common/types'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'

export type TagItemData = {
  id: string
  title: string
  tags?: TagsObj
}

type TagItemVariant = 'strong-grec' | 'strong-hebreu' | 'nave' | 'dictionary'

type Props = {
  item: TagItemData
  variant: TagItemVariant
  badge?: ReactNode
}

const getNavigationConfig = (
  variant: TagItemVariant,
  item: TagItemData
): { pathname: string; params: Record<string, string> } => {
  switch (variant) {
    case 'strong-grec':
      return {
        pathname: '/strong',
        params: { book: '40', reference: item.id },
      }
    case 'strong-hebreu':
      return {
        pathname: '/strong',
        params: { book: '1', reference: item.id },
      }
    case 'nave':
      return {
        pathname: '/nave-detail',
        params: { name_lower: item.id, name: item.title },
      }
    case 'dictionary':
      return {
        pathname: '/dictionnary-detail',
        params: { word: item.title },
      }
  }
}

const TagItemCard = ({ item, variant, badge }: Props) => {
  const router = useRouter()
  const navigationConfig = getNavigationConfig(variant, item)

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(navigationConfig as any)}>
      <VStack gap={6} mx={20} paddingVertical={15} borderBottomWidth={1} borderColor="border">
        <HStack gap={10} alignItems="center">
          <Text fontSize={14} bold>
            {item.title}
          </Text>
          {badge}
        </HStack>
      </VStack>
    </TouchableOpacity>
  )
}

// Pre-configured variants for convenience
export const StrongItemCard = ({
  item,
  variant,
}: {
  item: TagItemData
  variant: 'grec' | 'hebreu'
}) => {
  const { t } = useTranslation()
  const isGrec = variant === 'grec'

  return (
    <TagItemCard
      item={item}
      variant={isGrec ? 'strong-grec' : 'strong-hebreu'}
      badge={
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
      }
    />
  )
}

export const NaveItemCard = ({ item }: { item: TagItemData }) => (
  <TagItemCard item={item} variant="nave" />
)

export const DictionaryItemCard = ({ item }: { item: TagItemData }) => (
  <TagItemCard item={item} variant="dictionary" />
)

export default TagItemCard
