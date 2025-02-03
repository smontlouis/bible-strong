import styled from '@emotion/native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'

interface BookSelectorItemProps {
  book: Book
  isSelected: boolean
  onBookSelect: (book: Book) => void
}

const itemHeight = 46

const BookSelectorItem = ({
  book,
  isSelected,
  onBookSelect,
}: BookSelectorItemProps) => {
  const { t } = useTranslation()

  return (
    <Box>
      <TouchableOpacity activeOpacity={0.8} onPress={() => onBookSelect(book)}>
        <HStack
          px={20}
          backgroundColor={isSelected ? 'lightGrey' : 'transparent'}
          height={itemHeight}
          alignItems="center"
        >
          <Text
            fontSize={16}
            color={isSelected ? 'primary' : 'default'}
            bold={isSelected}
            flex
          >
            {t(book.Nom)}
          </Text>
        </HStack>
      </TouchableOpacity>
    </Box>
  )
}

export default BookSelectorItem
