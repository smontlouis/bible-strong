import SearchSpinner from '../SearchSpinner'
import { Fragment, type ReactNode } from 'react'
import Border from '~common/ui/Border'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { ListSectionTitle } from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import i18n from '~i18n'
import SharedSearchEntityResultRow from './SearchEntityResultRow'
import SearchTypeIcon from './SearchTypeIcon'
import type { SearchEntityResult } from './searchResultTypes'
import type { SearchItemType } from '~state/searchFilters'
export const SEARCH_SECTION_PREVIEW_LIMIT = 5
export const SEARCH_SECTION_LOAD_MORE_COUNT = 10

/** The hairline between two results, starting where their text starts. */
export const SearchResultSeparator = () => <Border className="ml-[20px]" />

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
  const visibleItems = renderItems ? section.items.slice(0, visibleCount) : []
  const remaining = Math.max(0, section.items.length - visibleCount)
  const rows = visibleItems
    .map(item => ({
      id: item.id,
      row: renderItem ? (
        renderItem(item)
      ) : (
        <SharedSearchEntityResultRow item={item} onPress={() => onPressItem(item)} />
      ),
    }))
    .filter(({ row }) => row != null)

  return (
    <Box className="overflow-hidden border-continuous">
      <HStack className="overflow-hidden border-continuous min-h-[36px] pl-[20px] pr-[12px] mt-[12px] items-center gap-[6px]">
        {section.iconType ? <SearchTypeIcon type={section.iconType} size={14} /> : null}
        <ListSectionTitle className="m-[0px] flex-[1]">{section.title}</ListSectionTitle>
        <Text
          className={headerAction ? 'text-[13px] text-grey' : 'text-[13px] text-grey mr-[8px]'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {section.count}
        </Text>
        {headerAction}
      </HStack>
      {statusMessage}
      {isLoading && !section.items.length ? <SearchSpinner /> : null}
      {rows.map(({ id, row }, index) => (
        <Fragment key={id}>
          {index > 0 && <SearchResultSeparator />}
          {row}
        </Fragment>
      ))}
      {showLoadMoreButton && (remaining > 0 || hasMore) ? (
        <TouchableBox
          className="overflow-hidden border-continuous py-[10px] px-[20px] items-start"
          onPress={onLoadMore}
        >
          <Box className="overflow-hidden border-continuous px-[12px] py-[6px] bg-light-grey rounded-full">
            <Text className="text-link text-[13px] font-bold">{String(i18n.t('Voir plus'))}</Text>
          </Box>
        </TouchableBox>
      ) : null}
    </Box>
  )
}

export default SearchSectionBlock
