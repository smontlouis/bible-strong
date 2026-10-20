import { twMerge } from '~common/ui/classNames'

import { MotiView } from '@alloc/moti'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, TouchableOpacity, useWindowDimensions } from 'react-native'
import { SharedValue, useDerivedValue } from 'react-native-reanimated'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import AccordionItem from './AccordionItem'
import {
  BOOK_ITEM_HEIGHT,
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
}

export const itemHeight = BOOK_ITEM_HEIGHT

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
  }: BookItemProps) => {
    const { t } = useTranslation()
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
              {bookName}
            </Text>
            <MotiView
              transition={{
                type: 'timing',
                duration: 300,
              }}
              animate={chevronAnimation as never}
            >
              <FeatherIcon color="grey" name="chevron-down" size={24} style={{ opacity: 0.5 }} />
            </MotiView>
          </HStack>
        </TouchableOpacity>
        {shouldRenderChapters && (
          <AccordionItem isExpanded={isExpanded} viewKey={book.Nom}>
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
                      className={twMerge(
                        isSelectedChapter ? 'bg-light-grey' : 'bg-opacity5',
                        'overflow-hidden border-continuous rounded-[8px] h-[60px] items-center justify-center'
                      )}
                      style={{ width: ITEM_WIDTH }}
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
                            isSelectedChapter ? 'text-primary' : 'text-default',
                            'text-center'
                          )}
                          style={{
                            width: ITEM_WIDTH,
                            fontWeight: isSelectedChapter ? 'bold' : undefined,
                          }}
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
      </Box>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.selectedChapter === nextProps.selectedChapter &&
      prevProps.shouldRenderChapters === nextProps.shouldRenderChapters
    )
  }
)

export default BookItem
