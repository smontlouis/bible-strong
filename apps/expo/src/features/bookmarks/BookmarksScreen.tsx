import BookmarkOptionsPanel from './BookmarkOptionsPanel'
import { getBookmarkVerse } from './bookmarkVerse'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import { useEntityListQueryFilters } from '~common/EntityListQueryFilters'
import type { EntityListSort } from '~features/entityListQuery/entityListQuery'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box, { VStack } from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { selectSortedBookmarks } from '~redux/selectors/bookmarks'
import type { Bookmark } from '~common/types'
import books from '~assets/bible_versions/books-desc'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
const getBookName = (bookNumber: number): string => {
  const bookData = books.find(b => b.Numero === bookNumber)
  return bookData?.Nom || `Livre ${bookNumber}`
}

const formatReference = (bookmark: Bookmark): string => {
  const bookName = getBookName(bookmark.book)
  const verse = getBookmarkVerse(bookmark.verse)
  if (verse === undefined) {
    return `${bookName} ${bookmark.chapter}`
  }
  return `${bookName} ${bookmark.chapter}:${verse}`
}

type BookmarkItemProps = {
  item: Bookmark
  onNavigate: (bookmark: Bookmark) => void
}

const BookmarkItem = ({ item, onNavigate }: BookmarkItemProps) => {
  const reference = formatReference(item)

  return (
    <Box className="overflow-hidden border-continuous">
      <Box className="overflow-hidden border-continuous flex-row py-[10px] pl-[20px] pr-[0px] items-center">
        <Link onPress={() => onNavigate(item)} style={{ flex: 1 }}>
          <Box className="overflow-hidden border-continuous flex-row items-center">
            <IonIcon name="bookmark" size={20} color={item.color} />
            <VStack className="overflow-hidden border-continuous gap-[4px] flex-[1] ml-[10px]">
              <Text className="font-bold" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-[14px]">{reference}</Text>
            </VStack>
          </Box>
        </Link>
        <BookmarkOptionsPanel bookmark={item} onNavigate={() => onNavigate(item)} />
      </Box>
      <Border className="mx-[20px]" />
    </Box>
  )
}

type BookmarksScreenProps = {
  isFormSheet?: boolean
}

const BookmarksScreen = ({ isFormSheet = false }: BookmarksScreenProps) => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
  const bookmarks = useSelector(selectSortedBookmarks)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<EntityListSort>('newest')
  const queryFilters = useEntityListQueryFilters({
    query,
    sort,
    onQueryChange: setQuery,
    onSortChange: setSort,
    sortOptions: [
      { value: 'newest', label: t('entityList.sort.newest') },
      { value: 'oldest', label: t('entityList.sort.oldest') },
    ],
  })
  const visibleBookmarks = bookmarks
    .filter(bookmark =>
      `${bookmark.name} ${formatReference(bookmark)}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    )
    .sort((a, b) => (sort === 'oldest' ? a.date - b.date : b.date - a.date))
  const handleNavigate = (bookmark: Bookmark) => {
    const verse = getBookmarkVerse(bookmark.verse)
    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: String(bookmark.book),
        chapter: String(bookmark.chapter),
        verse: verse !== undefined ? String(verse) : undefined,
        ...(bookmark.version && { version: bookmark.version }),
      },
    })
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <FiltersHeader
          hasBackButton={hasBackButton}
          title={t('Marque-pages')}
          filters={queryFilters.filters}
          onReset={() => {
            setQuery('')
            setSort('newest')
          }}
        />
        {bookmarks.length > 0 ? (
          <FlatList
            data={visibleBookmarks}
            renderItem={({ item }: { item: Bookmark }) => (
              <BookmarkItem item={item} onNavigate={handleNavigate} />
            )}
            keyExtractor={(item: Bookmark) => item.id}
            contentContainerStyle={{ paddingBottom: 70 }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/bookmark.svg')}
            message={t('Aucun marque-page...')}
          />
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default BookmarksScreen
