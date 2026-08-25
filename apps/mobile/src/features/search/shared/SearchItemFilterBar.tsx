import { ScrollView } from 'react-native'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { SearchItemFilters, SearchItemType } from '~state/searchFilters'
import SearchTypeIcon from './SearchTypeIcon'

export const searchItemFilterOrder: SearchItemType[] = [
  'passages',
  'notes',
  'links',
  'studies',
  'strong',
  'dictionary',
  'nave',
]

export const allSearchItemFilters = searchItemFilterOrder.reduce(
  (filters, type) => ({
    ...filters,
    [type]: true,
  }),
  {} as SearchItemFilters
)

export const searchItemFilterConfig: Record<
  SearchItemType,
  {
    labelKey: string
    color: string
  }
> = {
  passages: { labelKey: 'Passages', color: 'color1' },
  notes: { labelKey: 'Notes', color: 'color2' },
  links: { labelKey: 'Liens', color: 'secondary' },
  studies: { labelKey: 'Études', color: 'tertiary' },
  strong: { labelKey: 'Strong', color: 'primary' },
  dictionary: { labelKey: 'Dictionnaire', color: 'secondary' },
  nave: { labelKey: 'Nave', color: 'quint' },
}

export const getNextSearchItemFilters = (
  currentFilters: SearchItemFilters,
  type: SearchItemType,
  enabledTypes: SearchItemType[] = searchItemFilterOrder
) => {
  const enabledSet = new Set(enabledTypes)
  const enabledFilters = searchItemFilterOrder.filter(itemType => enabledSet.has(itemType))
  const activeTypes = enabledFilters.filter(itemType => currentFilters[itemType])
  const areAllEnabledActive = activeTypes.length === enabledFilters.length

  if (areAllEnabledActive) {
    return searchItemFilterOrder.reduce(
      (filters, itemType) => ({
        ...filters,
        [itemType]: itemType === type && enabledSet.has(itemType),
      }),
      {} as SearchItemFilters
    )
  }

  const toggled = { ...currentFilters, [type]: !currentFilters[type] }
  const hasActiveFilter = enabledFilters.some(itemType => toggled[itemType])

  if (hasActiveFilter) {
    return searchItemFilterOrder.reduce(
      (filters, itemType) => ({
        ...filters,
        [itemType]: enabledSet.has(itemType) ? toggled[itemType] : false,
      }),
      {} as SearchItemFilters
    )
  }

  return searchItemFilterOrder.reduce(
    (filters, itemType) => ({
      ...filters,
      [itemType]: enabledSet.has(itemType),
    }),
    {} as SearchItemFilters
  )
}

type Props = {
  itemFilters: SearchItemFilters
  onToggle: (type: SearchItemType) => void
  enabledTypes?: SearchItemType[]
  px?: number
  mt?: number
  mb?: number
  maxHeight?: number
}

const SearchItemFilterBar = ({
  itemFilters,
  onToggle,
  enabledTypes = searchItemFilterOrder,
  px = 20,
  maxHeight = 40,
}: Props) => {
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollView>(null)
  const enabledSet = new Set(enabledTypes)
  const enabledTypesKey = enabledTypes.join('|')

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: false })
  }, [enabledTypesKey])

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight, marginTop: 5 }}
      contentContainerStyle={{ paddingHorizontal: px }}
    >
      <HStack>
        {searchItemFilterOrder
          .filter(type => enabledSet.has(type))
          .map(type => {
            const config = searchItemFilterConfig[type]
            const isActive = itemFilters[type]

            return (
              <TouchableBox
                key={type}
                onPress={() => onToggle(type)}
                row
                center
                gap={6}
                px={6}
                py={6}
                mr={8}
                borderRadius={8}
                bg="lightGrey"
                opacity={isActive ? 1 : 0.6}
              >
                <SearchTypeIcon type={type} size={15} color={isActive ? config.color : 'grey'} />
                <Text fontSize={13} color={isActive ? undefined : 'grey'} numberOfLines={1}>
                  {t(config.labelKey)}
                </Text>
              </TouchableBox>
            )
          })}
      </HStack>
    </ScrollView>
  )
}

export default SearchItemFilterBar
