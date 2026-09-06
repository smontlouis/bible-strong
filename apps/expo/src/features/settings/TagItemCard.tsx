import { twMerge } from '~common/ui/classNames'

import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import type { ReactNode } from 'react'
import type { TagsObj } from '~common/types'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
export type TagItemData = {
  id: string | number
  title: string
  tags?: TagsObj
}

type TagItemVariant = 'strong-grec' | 'strong-hebreu' | 'nave' | 'dictionary'

type Props = {
  item: TagItemData
  variant: TagItemVariant
  badge?: ReactNode
}

const getNavigationConfig = (variant: TagItemVariant, item: TagItemData) => {
  switch (variant) {
    case 'strong-grec':
      return {
        pathname: '/strong',
        params: { book: '40', reference: String(item.id) },
      }
    case 'strong-hebreu':
      return {
        pathname: '/strong',
        params: { book: '1', reference: String(item.id) },
      }
    case 'nave':
      return {
        pathname: '/nave-detail',
        params: { name_lower: String(item.id), name: item.title },
      }
    case 'dictionary':
      return {
        pathname: '/dictionnary-detail',
        params: { word: item.title },
      }
  }
}

const TagItemCard = ({ item, variant, badge }: Props) => {
  const pushRouteOnce = usePushRouteOnce()
  const navigationConfig = getNavigationConfig(variant, item)

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={() => pushRouteOnce(navigationConfig)}
    >
      <VStack className="border-continuous overflow-hidden gap-[6px] mx-[20px] py-[15px] border-b-[1px] border-border">
        <HStack className="overflow-hidden border-continuous gap-[10px] items-center">
          <Text className="text-[14px] font-bold">{item.title}</Text>
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
          className={twMerge(
            'overflow-hidden border-continuous',
            twMerge(
              isGrec ? 'bg-primary' : 'bg-quart',
              'overflow-hidden border-continuous px-[8px] py-[3px] rounded-[20px]'
            )
          )}
        >
          <Text className="text-[10px] text-reverse font-bold">
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
