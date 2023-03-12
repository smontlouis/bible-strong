import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, SectionList } from 'react-native'
import books, { Book, sections } from '~assets/bible_versions/books-desc'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import BookSelectorItem from './BookSelectorItem'

interface BookSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  onNavigate: (index: number) => void
}

const BookSelector = ({ bibleAtom, onNavigate }: BookSelectorScreenProps) => {
  const { t } = useTranslation()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)

  const {
    data: { selectionMode, selectedBook },
  } = bible

  const onBookChange = (book: Book) => {
    onNavigate(1)
    actions.setTempSelectedBook(book)
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
              {t(title)}
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
              {t(book.Nom)}
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
          t={t}
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

export default BookSelector
