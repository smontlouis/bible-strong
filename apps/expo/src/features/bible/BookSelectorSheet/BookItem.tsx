import { twMerge } from '~common/ui/classNames'

import { MotiView } from '@alloc/moti'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, TouchableOpacity, useWindowDimensions } from 'react-native'
import { SharedValue, useDerivedValue } from 'react-native-reanimated'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { ListSeparator } from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import AccordionItem from './AccordionItem'
import {
  BOOK_ITEM_HEIGHT,
  getListChapterGridHeight,
  getListChapterLayout,
  LIST_CHAPTER_GAP,
  LIST_CHAPTER_SIZE,
  LIST_CHAPTER_VERTICAL_PADDING,
} from './bookSelectorScroll'
import { BOOK_SELECTION_EVENT } from './constants'
interface BookItemProps {
  book: Book
  /** The book's name in the reading's language. */
  bookName: string
  chapters?: number[]
  isSelected: boolean
  selectedChapter?: number
  onBookSelect: (book: Book) => void
  expandedBook: SharedValue<number | null>
  shouldRenderChapters: boolean
  /** Shows the chapters already expanded, as when the selector opens on this book. */
  expandsInstantly: boolean
}

export const itemHeight = BOOK_ITEM_HEIGHT
const ROW_PADDING_LEFT = 20

const BookItem = memo(
  ({
    book,
    bookName,
    chapters: availableChapters,
    isSelected,
    selectedChapter,
    onBookSelect,
    expandedBook,
    shouldRenderChapters,
    expandsInstantly,
  }: BookItemProps) => {
    const { t } = useTranslation()
    const theme = useTheme()
    const currentTint = colorWithOpacity(theme.colors.primary, 0.12)
    const { width: windowWidth } = useWindowDimensions()
    const isExpanded = useDerivedValue(() => expandedBook.get() === book.Numero)

    const chapters = useMemo(
      () => availableChapters || Array.from({ length: book.Chapitres }, (_, i) => i + 1),
      [availableChapters, book]
    )

    const ITEM_WIDTH = LIST_CHAPTER_SIZE
    const ITEM_GAP = LIST_CHAPTER_GAP
    const { maxWidth: MAX_WIDTH, horizontalMargin } = getListChapterLayout(windowWidth)
    const chevronAnimation = useDerivedValue(() => ({
      transform: [{ rotate: isExpanded.get() ? '180deg' : '0deg' }],
    }))

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
      <Box className="overflow-hidden border-continuous">
        <TouchableOpacity
          accessibilityLabel={bookName}
          accessibilityRole="button"
          accessibilityState={{ expanded: shouldRenderChapters }}
          activeOpacity={0.8}
          onPress={() => onBookSelect(book)}
        >
          <HStack
            className="overflow-hidden border-continuous items-center pr-[20px]"
            style={{
              height: itemHeight,
              paddingLeft: ROW_PADDING_LEFT,
              backgroundColor: isSelected ? currentTint : undefined,
            }}
          >
            <Text
              className={twMerge(
                isSelected ? 'text-primary font-semibold' : 'text-default',
                'text-[16px] flex-[1]'
              )}
            >
              {bookName}
            </Text>
            <MotiView
              transition={{
                type: 'timing',
                duration: 300,
              }}
              animate={chevronAnimation as never}
            >
              <FeatherIcon color="grey" name="chevron-down" size={18} />
            </MotiView>
          </HStack>
        </TouchableOpacity>
        {shouldRenderChapters && (
          <AccordionItem
            isExpanded={isExpanded}
            viewKey={book.Nom}
            initialHeight={
              expandsInstantly ? getListChapterGridHeight(chapters.length, windowWidth) : undefined
            }
          >
            <HStack
              className="overflow-hidden border-continuous"
              style={[
                { gap: ITEM_GAP },
                {
                  flexWrap: 'wrap',
                  paddingVertical: LIST_CHAPTER_VERTICAL_PADDING,
                  paddingHorizontal: horizontalMargin,
                  maxWidth: MAX_WIDTH,
                  alignSelf: 'center',
                },
              ]}
            >
              {chapters.map(chapter => {
                const isSelectedChapter = selectedChapter === chapter

                return (
                  <TouchableOpacity
                    key={chapter}
                    accessibilityLabel={`${t('Chapitre')} ${chapter}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelectedChapter }}
                    onPress={() => handleChapterSelect(chapter)}
                    onLongPress={() => handleLongPressChapterSelect(chapter)}
                  >
                    <Box
                      className="overflow-hidden border-continuous rounded-[8px] h-[60px] items-center justify-center"
                      style={{
                        width: ITEM_WIDTH,
                        backgroundColor: isSelectedChapter ? currentTint : theme.colors.opacity5,
                      }}
                    >
                      <Box
                        className="overflow-hidden border-continuous"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          justifyContent: 'center',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          className={twMerge(
                            isSelectedChapter ? 'text-primary font-semibold' : 'text-default',
                            'text-center'
                          )}
                          style={{ width: ITEM_WIDTH }}
                        >
                          {chapter}
                        </Text>
                      </Box>
                    </Box>
                  </TouchableOpacity>
                )
              })}
            </HStack>
          </AccordionItem>
        )}
        {/* Under the book and its open chapters, which belong to it */}
        <ListSeparator inset={ROW_PADDING_LEFT} overlay />
      </Box>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.selectedChapter === nextProps.selectedChapter &&
      prevProps.shouldRenderChapters === nextProps.shouldRenderChapters &&
      prevProps.expandsInstantly === nextProps.expandsInstantly
    )
  }
)

export default BookItem
