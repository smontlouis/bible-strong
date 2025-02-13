import React, { memo, useMemo, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import AccordionItem from './AccordionItem'
import {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'
import { MotiView } from 'moti'
import { FeatherIcon } from '~common/ui/Icon'
import { DeviceEventEmitter } from 'react-native'
import { BOOK_SELECTION_EVENT } from './BookSelectorBottomSheet'

interface BookItemProps {
  book: Book
  isSelected: boolean
  onBookSelect: (book: Book) => void
  expandedBook: SharedValue<number | null>
}

export const itemHeight = 46

const BookItem = memo(
  ({ book, isSelected, onBookSelect, expandedBook }: BookItemProps) => {
    const { t } = useTranslation()
    const isExpanded = useDerivedValue(() => expandedBook.value === book.Numero)

    const chapters = useMemo(
      () => Array.from({ length: book.Chapitres }, (_, i) => i + 1),
      [book]
    )

    const handleChapterSelect = (chapter: number) => {
      expandedBook.value = null
      DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
        type: 'select',
        book,
        chapter,
      })
    }

    const handleLongPressChapterSelect = (chapter: number) => {
      expandedBook.value = null
      DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
        type: 'longPress',
        book,
        chapter,
      })
    }

    return (
      <Box>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onBookSelect(book)}
        >
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
            <MotiView
              transition={{
                type: 'timing',
                duration: 300,
              }}
              // @ts-expect-error
              animate={useDerivedValue(() => ({
                transform: [{ rotate: isExpanded.value ? '180deg' : '0deg' }],
              }))}
            >
              <FeatherIcon
                color="grey"
                name="chevron-down"
                size={24}
                style={{ opacity: 0.5 }}
              />
            </MotiView>
          </HStack>
        </TouchableOpacity>
        <AccordionItem isExpanded={isExpanded} viewKey={book.Nom}>
          <HStack gap={10} style={{ flexWrap: 'wrap' }} padding={10}>
            {chapters.map(chapter => (
              <TouchableOpacity
                key={chapter}
                onPress={() => handleChapterSelect(chapter)}
                onLongPress={() => handleLongPressChapterSelect(chapter)}
              >
                <Box
                  backgroundColor="opacity5"
                  borderRadius={6}
                  minWidth={60}
                  minHeight={60}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text>{chapter}</Text>
                </Box>
              </TouchableOpacity>
            ))}
          </HStack>
        </AccordionItem>
      </Box>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.isSelected === nextProps.isSelected
  }
)

export default BookItem
