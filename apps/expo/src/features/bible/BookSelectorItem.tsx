import { twMerge } from '~common/ui/classNames'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
interface BookSelectorItemProps {
  book: Book
  isSelected: boolean
  onBookSelect: (book: Book) => void
}

const itemHeight = 46

const BookSelectorItem = ({ book, isSelected, onBookSelect }: BookSelectorItemProps) => {
  const { t } = useTranslation()

  return (
    <Box className="overflow-hidden border-continuous">
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.8}
        onPress={() => onBookSelect(book)}
      >
        <HStack
          className={twMerge(
            'overflow-hidden border-continuous',
            twMerge(
              isSelected ? 'bg-light-grey' : 'bg-[transparent]',
              'overflow-hidden border-continuous px-[20px] items-center'
            )
          )}
          style={{ height: itemHeight }}
        >
          <Text
            className={twMerge(
              isSelected ? 'text-primary' : 'text-default',
              'text-[16px] flex-[1]'
            )}
            style={{ fontWeight: isSelected ? 'bold' : undefined }}
          >
            {t(book.Nom)}
          </Text>
        </HStack>
      </TouchableOpacity>
    </Box>
  )
}

export default BookSelectorItem
