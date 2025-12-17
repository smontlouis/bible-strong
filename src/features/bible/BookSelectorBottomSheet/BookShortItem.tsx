import { Theme, useTheme } from '@emotion/react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native'
import Popover from 'react-native-popover-view'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'

import { wp } from '~helpers/utils'
import { BOOK_SELECTION_EVENT } from './constants'

interface BookShortItemProps {
  book: Book
  isSelected: boolean
  isNT: boolean
  onChange: (book: Book) => void
}
export const BookShortItem = ({ book, isSelected, isNT, onChange }: BookShortItemProps) => {
  const { t } = useTranslation()
  const theme: Theme = useTheme()
  const bookName = t(book.Nom).replace(/\s/g, '').substr(0, 3)
  const [showPopover, setShowPopover] = useState(false)
  const { width: windowWidth } = useWindowDimensions()

  const chapters = useMemo(() => Array.from({ length: book.Chapitres }, (_, i) => i + 1), [book])

  // Configuration pour le centrage des éléments
  const ITEM_WIDTH = 40
  const ITEM_GAP = 10
  const MAX_WIDTH = Math.min(500, windowWidth - 20) // 20px pour le padding du popover
  const PADDING = 0

  const availableWidth = MAX_WIDTH - PADDING * 2
  const itemsPerRow = Math.floor(availableWidth / (ITEM_WIDTH + ITEM_GAP))
  const totalItemsWidth = itemsPerRow * ITEM_WIDTH + (itemsPerRow - 1) * ITEM_GAP
  const horizontalMargin = (MAX_WIDTH - totalItemsWidth) / 2

  const handleChapterSelect = (chapter: number) => {
    setShowPopover(false)
    DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
      type: 'select',
      book,
      chapter,
    })
  }

  const handleLongPressChapterSelect = (chapter: number) => {
    setShowPopover(false)
    DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
      type: 'longPress',
      book,
      chapter,
    })
  }

  return (
    <Popover
      isVisible={showPopover}
      onRequestClose={() => setShowPopover(false)}
      popoverStyle={{
        backgroundColor: theme.colors.reverse,
        borderRadius: 10,
      }}
      from={
        <TouchableOpacity onPress={() => setShowPopover(true)}>
          <Box alignItems="center" justifyContent="center" height={45} width={wp(99) / 5}>
            <Text
              {...{
                color: isSelected ? 'primary' : isNT ? 'quart' : 'default',
                fontWeight: isSelected ? 'bold' : 'normal',
                fontSize: 16,
              }}
            >
              {bookName}
            </Text>
          </Box>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={{
          maxHeight: 200,
        }}
      >
        <HStack
          padding={10}
          gap={ITEM_GAP}
          style={{
            flexWrap: 'wrap',
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
                minWidth={ITEM_WIDTH}
                minHeight={40}
                alignItems="center"
                justifyContent="center"
              >
                <Text>{chapter}</Text>
              </Box>
            </TouchableOpacity>
          ))}
        </HStack>
      </ScrollView>
    </Popover>
  )
}
