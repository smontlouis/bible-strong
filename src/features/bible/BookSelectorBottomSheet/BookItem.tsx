import { MotiView } from '@alloc/moti'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, useWindowDimensions } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { SharedValue, useDerivedValue } from 'react-native-reanimated'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import AccordionItem from './AccordionItem'
import { BOOK_SELECTION_EVENT } from './constants'

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
    const { width: windowWidth } = useWindowDimensions()
    const isExpanded = useDerivedValue(() => expandedBook.get() === book.Numero)

    const chapters = useMemo(() => Array.from({ length: book.Chapitres }, (_, i) => i + 1), [book])

    const ITEM_WIDTH = 60
    const ITEM_GAP = 10
    const MAX_WIDTH = Math.min(500, windowWidth)
    const PADDING = 0

    const availableWidth = MAX_WIDTH - PADDING * 2
    const itemsPerRow = Math.floor(availableWidth / (ITEM_WIDTH + ITEM_GAP))
    const totalItemsWidth = itemsPerRow * ITEM_WIDTH + (itemsPerRow - 1) * ITEM_GAP
    const horizontalMargin = (MAX_WIDTH - totalItemsWidth) / 2

    const handleChapterSelect = (chapter: number) => {
      DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
        type: 'select',
        book,
        chapter,
      })
    }

    const handleLongPressChapterSelect = (chapter: number) => {
      DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
        type: 'longPress',
        book,
        chapter,
      })
    }

    return (
      <Box>
        <TouchableOpacity activeOpacity={0.8} onPress={() => onBookSelect(book)}>
          <HStack
            px={20}
            backgroundColor={isSelected ? 'lightGrey' : 'transparent'}
            height={itemHeight}
            alignItems="center"
          >
            <Text fontSize={16} color={isSelected ? 'primary' : 'default'} bold={isSelected} flex>
              {t(book.Nom)}
            </Text>
            <MotiView
              transition={{
                type: 'timing',
                duration: 300,
              }}
              // @ts-expect-error
              animate={useDerivedValue(() => ({
                transform: [{ rotate: isExpanded.get() ? '180deg' : '0deg' }],
              }))}
            >
              <FeatherIcon color="grey" name="chevron-down" size={24} style={{ opacity: 0.5 }} />
            </MotiView>
          </HStack>
        </TouchableOpacity>
        <AccordionItem isExpanded={isExpanded} viewKey={book.Nom}>
          <HStack
            gap={ITEM_GAP}
            style={{
              flexWrap: 'wrap',
              paddingVertical: 10,
              paddingHorizontal: horizontalMargin,
              maxWidth: MAX_WIDTH,
              alignSelf: 'center',
            }}
          >
            {chapters.map(chapter => (
              <TouchableOpacity
                key={chapter}
                onPress={() => handleChapterSelect(chapter)}
                onLongPress={() => handleLongPressChapterSelect(chapter)}
              >
                <Box
                  backgroundColor="opacity5"
                  borderRadius={6}
                  width={ITEM_WIDTH}
                  height={60}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Box
                    style={{
                      position: 'absolute',
                      inset: 0,
                      justifyContent: 'center',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Text textAlign="center">{chapter}</Text>
                  </Box>
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
