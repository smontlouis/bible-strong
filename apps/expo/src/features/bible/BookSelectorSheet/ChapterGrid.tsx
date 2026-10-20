import { twMerge } from '~common/ui/classNames'

import { SheetScrollView } from '~common/sheet'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getChapterRowScrollOffset } from './bookSelectorScroll'
import { BOOK_SELECTION_EVENT } from './constants'
interface ChapterGridProps {
  book: Book
  chapters?: number[]
  selectedChapter?: number
}

const ITEM_SIZE = 48
const ITEM_GAP = 10
const MAX_WIDTH = 500
const HORIZONTAL_PADDING = 10
const BOTTOM_SCROLL_CLEARANCE = ITEM_SIZE + ITEM_GAP
const TOP_PADDING = 16

const ChapterGrid = ({ book, chapters: availableChapters, selectedChapter }: ChapterGridProps) => {
  const { t } = useTranslation()
  const { width: windowWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const scrollViewRef = useRef<ScrollView>(null)
  const viewportHeightRef = useRef(0)
  const hasScrolledToSelectionRef = useRef(false)
  const chapters =
    availableChapters ?? Array.from({ length: book.Chapitres }, (_, index) => index + 1)
  const gridWidth = Math.min(MAX_WIDTH, windowWidth)
  const availableWidth = gridWidth - HORIZONTAL_PADDING * 2
  const itemsPerRow = Math.max(1, Math.floor((availableWidth + ITEM_GAP) / (ITEM_SIZE + ITEM_GAP)))
  const itemsWidth = itemsPerRow * ITEM_SIZE + (itemsPerRow - 1) * ITEM_GAP
  const horizontalPadding = Math.max(HORIZONTAL_PADDING, (gridWidth - itemsWidth) / 2)

  const scrollToSelectedChapter = () => {
    if (hasScrolledToSelectionRef.current || selectedChapter === undefined) return
    if (viewportHeightRef.current <= 0) return

    hasScrolledToSelectionRef.current = true
    const offset = getChapterRowScrollOffset({
      chapterIndex: chapters.indexOf(selectedChapter),
      itemsPerRow,
      itemSize: ITEM_SIZE,
      gap: ITEM_GAP,
      gridTop: TOP_PADDING,
      viewportHeight: viewportHeightRef.current,
      baseOffset: 0,
    })
    if (offset > 0) {
      scrollViewRef.current?.scrollTo({ y: offset, animated: false })
    }
  }

  const emitSelection = (type: 'select' | 'longPress', chapter: number) => {
    DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
      type,
      book,
      chapter,
    })
  }

  return (
    <SheetScrollView
      ref={scrollViewRef}
      onLayout={event => {
        viewportHeightRef.current = event.nativeEvent.layout.height
        scrollToSelectedChapter()
      }}
      onContentSizeChange={scrollToSelectedChapter}
      testID={`book-selector-chapter-grid-${book.Numero}`}
      contentContainerStyle={{
        alignSelf: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ITEM_GAP,
        maxWidth: gridWidth,
        paddingBottom: insets.bottom + BOTTOM_SCROLL_CLEARANCE,
        paddingHorizontal: horizontalPadding,
        paddingTop: TOP_PADDING,
      }}
      showsVerticalScrollIndicator
    >
      {chapters.map(chapter => {
        const isSelected = selectedChapter === chapter

        return (
          <TouchableBox
            className={twMerge(
              'overflow-hidden border-continuous',
              twMerge(
                isSelected ? 'bg-light-grey' : 'bg-opacity5',
                'overflow-hidden border-continuous items-center rounded-[8px] justify-center'
              )
            )}
            key={chapter}
            testID={`book-selector-chapter-${book.Numero}-${chapter}`}
            accessibilityLabel={`${t('Chapitre')} ${chapter}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            activeOpacity={0.7}
            onLongPress={() => emitSelection('longPress', chapter)}
            onPress={() => emitSelection('select', chapter)}
            style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
          >
            <Box className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center">
              <Text
                className={twMerge(isSelected ? 'text-primary' : 'text-default', 'text-center')}
                style={{ fontWeight: isSelected ? 'bold' : undefined }}
              >
                {chapter}
              </Text>
            </Box>
          </TouchableBox>
        )
      })}
    </SheetScrollView>
  )
}

export default ChapterGrid
