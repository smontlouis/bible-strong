import { MenuView } from '@expo/ui/community/menu'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter } from 'react-native'

import { Book } from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { wp } from '~helpers/utils'
import { BOOK_SELECTION_EVENT } from './constants'

interface BookShortItemProps {
  book: Book
  chapters?: number[]
  isSelected: boolean
  isNT: boolean
  onChange: (book: Book) => void
}

export const BookShortItem = ({
  book,
  chapters: availableChapters,
  isSelected,
  isNT,
}: BookShortItemProps) => {
  const { t } = useTranslation()
  const bookName = t(book.Nom).replace(/\s/g, '').substr(0, 3)

  const chapters = availableChapters || Array.from({ length: book.Chapitres }, (_, i) => i + 1)

  const handleChapterSelect = (chapter: number) => {
    DeviceEventEmitter.emit(BOOK_SELECTION_EVENT, {
      type: 'select',
      book,
      chapter,
    })
  }

  return (
    <MenuView
      actions={chapters.map(chapter => ({
        id: String(chapter),
        title: String(chapter),
      }))}
      onPressAction={({ nativeEvent }) => handleChapterSelect(Number(nativeEvent.event))}
    >
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
    </MenuView>
  )
}
