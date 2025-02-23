import { Theme, useTheme } from '@emotion/react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, ScrollView, TouchableOpacity } from 'react-native'
import Popover from 'react-native-popover-view'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'

import { wp } from '~helpers/utils'
import { BOOK_SELECTION_EVENT } from './BookSelectorBottomSheet'

interface BookShortItemProps {
  book: Book
  isSelected: boolean
  isNT: boolean
  onChange: (book: Book) => void
}
export const BookShortItem = ({
  book,
  isSelected,
  isNT,
  onChange,
}: BookShortItemProps) => {
  const { t } = useTranslation()
  const theme: Theme = useTheme()
  const bookName = t(book.Nom).replace(/\s/g, '').substr(0, 3)
  const [showPopover, setShowPopover] = useState(false)

  const chapters = useMemo(
    () => Array.from({ length: book.Chapitres }, (_, i) => i + 1),
    [book]
  )

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
          <Box
            alignItems="center"
            justifyContent="center"
            height={45}
            width={wp(99) / 5}
          >
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
        <HStack padding={10} gap={10} style={{ flexWrap: 'wrap' }}>
          {chapters.map((chapter) => (
            <TouchableOpacity
              key={chapter}
              onPress={() => handleChapterSelect(chapter)}
              onLongPress={() => handleLongPressChapterSelect(chapter)}
            >
              <Box
                backgroundColor="opacity5"
                borderRadius={6}
                minWidth={40}
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
