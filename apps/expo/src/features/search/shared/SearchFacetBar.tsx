import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import { twMerge } from '~common/ui/classNames'

import { useTranslation } from 'react-i18next'
import { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { SearchFacet, SearchFacetId } from '../searchResultsModel'
import { searchItemFilterConfig } from './SearchItemFilterBar'
import SearchTypeIcon from './SearchTypeIcon'
type Props = {
  facets: SearchFacet[]
  selectedFacet: SearchFacetId
  onSelect: (facet: SearchFacetId) => void
}

const SearchFacetBar = ({ facets, selectedFacet, onSelect }: Props) => {
  const { t } = useTranslation()

  return (
    <HorizontalControlScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 40, marginTop: 5, marginBottom: 5 }}
      contentContainerStyle={{ paddingHorizontal: 20 }}
    >
      <HStack className="overflow-hidden border-continuous">
        {facets.map(facet => {
          const isSelected = facet.id === selectedFacet
          const label =
            facet.id === 'all' ? t('Tout') : t(searchItemFilterConfig[facet.id].labelKey)

          return (
            <TouchableBox
              className="overflow-hidden border-continuous flex-row items-center justify-center gap-[6px] px-[6px] py-[6px] mr-[8px] rounded-[8px] bg-light-grey"
              key={facet.id}
              onPress={() => onSelect(facet.id)}
              style={{ opacity: isSelected ? 1 : 0.6 }}
            >
              {facet.id === 'all' ? (
                <FeatherIcon name="grid" size={15} color={isSelected ? 'primary' : 'grey'} />
              ) : (
                <SearchTypeIcon
                  type={facet.id}
                  size={15}
                  color={isSelected ? searchItemFilterConfig[facet.id].color : 'grey'}
                />
              )}
              <Text
                className={twMerge(isSelected ? 'text-default' : 'text-grey', 'text-[13px]')}
                numberOfLines={1}
              >
                {label}
              </Text>
              <Text
                className={twMerge(
                  isSelected ? 'text-tertiary' : 'text-grey',
                  'text-[12px] font-bold'
                )}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {facet.count}
              </Text>
            </TouchableBox>
          )
        })}
      </HStack>
    </HorizontalControlScrollView>
  )
}

export default SearchFacetBar
