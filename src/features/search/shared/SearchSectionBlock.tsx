import type { ReactNode } from 'react'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Chip } from '~common/ui/NewChip'
import i18n from '~i18n'
import SharedSearchEntityResultRow from './SearchEntityResultRow'
import SearchTypeIcon from './SearchTypeIcon'
import type { SearchEntityResult } from './searchResultTypes'
import type { SearchItemType } from '~state/searchFilters'

export const SEARCH_SECTION_PREVIEW_LIMIT = 5
export const SEARCH_SECTION_LOAD_MORE_COUNT = 10

export type SearchResultSection<SectionId extends string = string> = {
  id: SectionId
  title: string
  count: number
  items: SearchEntityResult[]
  iconType?: SearchItemType
}

type Props<SectionId extends string = string> = {
  section: SearchResultSection<SectionId>
  visibleCount: number
  onLoadMore: () => void
  onPressItem: (item: SearchEntityResult) => void
  renderItem?: (item: SearchEntityResult) => ReactNode
  statusMessage?: ReactNode
  isLoading?: boolean
  hasMore?: boolean
  showLoadMoreButton?: boolean
  headerAction?: ReactNode
}

const SearchSectionBlock = <SectionId extends string = string>({
  section,
  visibleCount,
  onLoadMore,
  onPressItem,
  renderItem,
  statusMessage,
  isLoading,
  hasMore = false,
  showLoadMoreButton = true,
  headerAction,
}: Props<SectionId>) => {
  const visibleItems = section.items.slice(0, visibleCount)
  const remaining = Math.max(0, section.items.length - visibleCount)

  return (
    <Box pt={10}>
      <HStack px={20} py={8} alignItems="center" gap={8}>
        {section.iconType ? (
          <Box
            width={36}
            height={36}
            borderRadius={10}
            bg="lightGrey"
            alignItems="center"
            justifyContent="center"
          >
            <SearchTypeIcon type={section.iconType} />
          </Box>
        ) : null}
        <Text title fontSize={16} opacity={0.6}>
          {section.title}
        </Text>
        <Chip variant="bold">{section.count}</Chip>
        <Box flex />
        {headerAction}
      </HStack>
      {statusMessage}
      {isLoading && !visibleItems.length ? (
        <Box px={20} py={16}>
          <Text color="grey">{String(i18n.t('Recherche en cours...'))}</Text>
        </Box>
      ) : null}
      {visibleItems.map(item =>
        renderItem ? (
          renderItem(item)
        ) : (
          <SharedSearchEntityResultRow
            key={item.id}
            item={item}
            onPress={() => onPressItem(item)}
          />
        )
      )}
      {showLoadMoreButton && (remaining > 0 || hasMore) ? (
        <TouchableBox onPress={onLoadMore} py={10} px={20} alignItems="flex-start">
          <Box px={10} py={6} bg="lightGrey" borderRadius={6}>
            <Text color="primary" fontSize={13} bold>
              {String(i18n.t('Voir plus'))}
            </Text>
          </Box>
        </TouchableBox>
      ) : null}
    </Box>
  )
}

export default SearchSectionBlock
