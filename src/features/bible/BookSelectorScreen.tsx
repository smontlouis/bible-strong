import React from 'react'
import { ScrollView, SectionList } from 'react-native'
import { useSelector, useDispatch } from 'react-redux'
import books, { Book, sections } from '~assets/bible_versions/books-desc'
import { setTempSelectedBook } from '~redux/modules/bible'
import { RootState } from '~redux/modules/reducer'
import BookSelectorItem from './BookSelectorItem'
import { NavigationStackProp } from 'react-navigation-stack'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { LinkBox } from '~common/Link'

interface Props {
  navigation: NavigationStackProp<any>
}

const BookSelector = ({ navigation }: Props) => {
  const dispatch = useDispatch()
  const selectedBook = useSelector(
    (state: RootState) => state.bible.temp.selectedBook
  )

  const selectionMode = useSelector(
    (state: RootState) => state.bible.selectionMode
  )

  const onBookChange = (book: Book) => {
    navigation.navigate('Chapitre')
    dispatch(setTempSelectedBook(book))
  }

  if (selectionMode === 'list') {
    return (
      <SectionList
        contentContainerStyle={{ paddingTop: 0 }}
        sections={sections}
        keyExtractor={item => item.Nom}
        renderSectionHeader={({ section: { title } }) => (
          <Box
            mt={10}
            px={20}
            py={10}
            borderBottomWidth={3}
            borderColor="opacity5"
            alignSelf="center"
          >
            <Text fontSize={14} color="tertiary" textAlign="center" bold>
              {title}
            </Text>
          </Box>
        )}
        renderItem={({ item: book }) => (
          <LinkBox onPress={() => onBookChange(book)} padding={20}>
            <Text
              fontSize={16}
              color={
                book.Numero === selectedBook.Numero ? 'primary' : 'default'
              }
              {...(book.Numero === selectedBook.Numero && { bold: true })}
            >
              {book.Nom}
            </Text>
          </LinkBox>
        )}
      />
    )
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexWrap: 'wrap',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingTop: 10,
      }}
    >
      {Object.values(books).map(book => (
        <BookSelectorItem
          isNT={book.Numero >= 40}
          key={book.Numero}
          onChange={onBookChange}
          book={book}
          isSelected={book.Numero === selectedBook.Numero}
        />
      ))}
    </ScrollView>
  )
}

BookSelector.tabBarLabel = 'LIVRE'

export default BookSelector
