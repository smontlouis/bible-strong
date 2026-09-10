import { getUniverseColor } from '~themes/universeColors'
import { twMerge } from '~common/ui/classNames'

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
  passages: { labelKey: 'Passages', color: getUniverseColor('passages') },
  notes: { labelKey: 'Notes', color: getUniverseColor('notes') },
  links: { labelKey: 'Liens', color: getUniverseColor('links') },
  studies: { labelKey: 'Études', color: getUniverseColor('studies') },
  strong: { labelKey: 'Strong', color: getUniverseColor('strong') },
  dictionary: { labelKey: 'Dictionnaire', color: getUniverseColor('dictionary') },
  nave: { labelKey: 'Nave', color: getUniverseColor('nave') },
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
      <HStack className="overflow-hidden border-continuous">
        {searchItemFilterOrder
          .filter(type => enabledSet.has(type))
          .map(type => {
            const config = searchItemFilterConfig[type]
            const isActive = itemFilters[type]

            return (
              <TouchableBox
                className="overflow-hidden border-continuous flex-row items-center justify-center gap-[6px] px-[6px] py-[6px] mr-[8px] rounded-[8px] bg-light-grey"
                key={type}
                onPress={() => onToggle(type)}
                style={{ opacity: isActive ? 1 : 0.6 }}
              >
                <SearchTypeIcon type={type} size={15} color={isActive ? config.color : 'grey'} />
                <Text
                  className={twMerge(isActive ? 'text-default' : 'text-grey', 'text-[13px]')}
                  numberOfLines={1}
                >
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
