import SearchSpinner from '../SearchSpinner'
import { resolveUniverseColors } from '~themes/universeColors'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  renderItems?: boolean
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
  renderItems = true,
}: Props<SectionId>) => {
  const stylingTheme = useStylingTheme()

  const visibleItems = renderItems ? section.items.slice(0, visibleCount) : []
  const remaining = Math.max(0, section.items.length - visibleCount)

  return (
    <Box className="overflow-hidden border-continuous pt-[10px]">
      <HStack className="overflow-hidden border-continuous px-[20px] py-[8px] items-center gap-[8px]">
        {section.iconType ? (
          <Box
            className="overflow-hidden border-continuous w-[36px] h-[36px] rounded-[10px] items-center justify-center"
            style={{
              backgroundColor: resolveUniverseColors(stylingTheme.colors, section.iconType)
                .background,
            }}
          >
            <SearchTypeIcon type={section.iconType} />
          </Box>
        ) : null}
        <Text
          className="text-[16px] opacity-[0.6]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {section.title}
        </Text>
        <Chip variant="bold">{section.count}</Chip>
        <Box className="overflow-hidden border-continuous flex-[1]" />
        {headerAction}
      </HStack>
      {statusMessage}
      {isLoading && !section.items.length ? <SearchSpinner /> : null}
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
        <TouchableBox
          className="overflow-hidden border-continuous py-[10px] px-[20px] items-start"
          onPress={onLoadMore}
        >
          <Box className="overflow-hidden border-continuous px-[10px] py-[6px] bg-light-grey rounded-[6px]">
            <Text className="text-primary text-[13px] font-bold">
              {String(i18n.t('Voir plus'))}
            </Text>
          </Box>
        </TouchableBox>
      ) : null}
    </Box>
  )
}

export default SearchSectionBlock
