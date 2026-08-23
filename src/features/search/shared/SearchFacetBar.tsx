import { ScrollView } from 'react-native'
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
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 40, marginTop: 5, marginBottom: 5 }}
      contentContainerStyle={{ paddingHorizontal: 20 }}
    >
      <HStack>
        {facets.map(facet => {
          const isSelected = facet.id === selectedFacet
          const label =
            facet.id === 'all' ? t('Tout') : t(searchItemFilterConfig[facet.id].labelKey)

          return (
            <TouchableBox
              key={facet.id}
              onPress={() => onSelect(facet.id)}
              row
              center
              gap={6}
              px={6}
              py={6}
              mr={8}
              borderRadius={8}
              bg="lightGrey"
              opacity={isSelected ? 1 : 0.6}
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
              <Text fontSize={13} color={isSelected ? undefined : 'grey'} numberOfLines={1}>
                {label}
              </Text>
              <Text
                fontSize={12}
                bold
                color={isSelected ? 'tertiary' : 'grey'}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {facet.count}
              </Text>
            </TouchableBox>
          )
        })}
      </HStack>
    </ScrollView>
  )
}

export default SearchFacetBar
