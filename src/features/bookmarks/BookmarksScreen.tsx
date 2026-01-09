import styled from '@emotion/native'
import React, { useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

import { useRouter } from 'expo-router'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box, { VStack } from '~common/ui/Box'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { selectSortedBookmarks } from '~redux/selectors/bookmarks'
import type { Bookmark } from '~common/types'
import BookmarkModal from './BookmarkModal'
import books from '~assets/bible_versions/books-desc'

const ColorIndicator = styled.View<{ color: string }>(({ color }) => ({
  width: 12,
  height: 12,
  borderRadius: 6,
  backgroundColor: color,
  marginRight: 12,
}))

const getBookName = (bookNumber: number): string => {
  const bookData = books.find((b: any) => b.Numero === bookNumber)
  return bookData?.Nom || `Livre ${bookNumber}`
}

const formatReference = (bookmark: Bookmark): string => {
  const bookName = getBookName(bookmark.book)
  if (bookmark.verse === undefined) {
    return `${bookName} ${bookmark.chapter}`
  }
  return `${bookName} ${bookmark.chapter}:${bookmark.verse}`
}

type BookmarkItemProps = {
  item: Bookmark
  onEdit: (bookmark: Bookmark) => void
  onNavigate: (bookmark: Bookmark) => void
}

const BookmarkItem = ({ item, onEdit, onNavigate }: BookmarkItemProps) => {
  const reference = formatReference(item)

  return (
    <Box>
      <Box row py={10} pl={20} pr={0} alignItems="center">
        <Link onPress={() => onNavigate(item)} style={{ flex: 1 }}>
          <Box row alignItems="center">
            <IonIcon name="bookmark" size={20} color={item.color} />
            <VStack gap={4} flex ml={10}>
              <Text bold numberOfLines={1}>
                {item.name}
              </Text>
              <Text fontSize={14}>{reference}</Text>
            </VStack>
          </Box>
        </Link>
        <Link onPress={() => onEdit(item)} padding>
          <FeatherIcon name="more-vertical" size={20} />
        </Link>
      </Box>
      <Border marginHorizontal={20} />
    </Box>
  )
}

const BookmarksScreen = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const bookmarks = useSelector(selectSortedBookmarks)
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null)
  const bookmarkModalRef = useRef<BottomSheetModal>(null)

  const handleEdit = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark)
    setTimeout(() => bookmarkModalRef.current?.present(), 0)
  }

  const handleNavigate = (bookmark: Bookmark) => {
    router.push({
      pathname: '/bible-view',
      params: {
        isReadOnly: 'true',
        book: String(bookmark.book),
        chapter: String(bookmark.chapter),
        verse: bookmark.verse !== undefined ? String(bookmark.verse) : undefined,
      },
    })
  }

  const handleCloseModal = () => {
    setSelectedBookmark(null)
  }

  return (
    <Container>
      <Header hasBackButton title={t('Marque-pages')} />
      {bookmarks.length > 0 ? (
        <FlatList
          data={bookmarks}
          renderItem={({ item }: { item: Bookmark }) => (
            <BookmarkItem item={item} onEdit={handleEdit} onNavigate={handleNavigate} />
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
      <BookmarkModal
        bottomSheetRef={bookmarkModalRef}
        onClose={handleCloseModal}
        existingBookmark={selectedBookmark || undefined}
      />
    </Container>
  )
}

export default BookmarksScreen
