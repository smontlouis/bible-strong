import type { ReactNode } from 'react'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Chip } from '~common/ui/NewChip'
import i18n from '~i18n'
import SharedSearchEntityResultRow from './SearchEntityResultRow'
import type { SearchEntityResult } from './searchResultTypes'

export const SEARCH_SECTION_PREVIEW_LIMIT = 5
export const SEARCH_SECTION_LOAD_MORE_COUNT = 10

export type SearchResultSection<SectionId extends string = string> = {
  id: SectionId
  title: string
  count: number
  items: SearchEntityResult[]
}

type Props<SectionId extends string = string> = {
  section: SearchResultSection<SectionId>
  visibleCount: number
  onLoadMore: () => void
  onPressItem: (item: SearchEntityResult) => void
  renderItem?: (item: SearchEntityResult) => ReactNode
  statusMessage?: ReactNode
  isLoading?: boolean
}

const SearchSectionBlock = <SectionId extends string = string>({
  section,
  visibleCount,
  onLoadMore,
  onPressItem,
  renderItem,
  statusMessage,
  isLoading,
}: Props<SectionId>) => {
  const visibleItems = section.items.slice(0, visibleCount)
  const remaining = Math.max(0, section.items.length - visibleCount)

  return (
    <Box pt={10}>
      <HStack px={20} py={8} alignItems="center" gap={8}>
        <Text title fontSize={16} opacity={0.6}>
          {section.title}
        </Text>
        <Chip variant="bold">{section.count}</Chip>
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
      {remaining > 0 ? (
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
