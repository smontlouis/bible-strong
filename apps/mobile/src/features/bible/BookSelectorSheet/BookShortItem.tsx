import { useTranslation } from 'react-i18next'

import { Book } from '~assets/bible_versions/books-desc'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { wp } from '~helpers/utils'

interface BookShortItemProps {
  book: Book
  isSelected: boolean
  isNT: boolean
  onChange: (book: Book) => void
}

export const BookShortItem = ({ book, isSelected, isNT, onChange }: BookShortItemProps) => {
  const { t } = useTranslation()
  const bookName = t(book.Nom).replace(/\s/g, '').substr(0, 3)

  return (
    <TouchableBox
      testID={`book-selector-grid-book-${book.Numero}`}
      accessibilityLabel={t(book.Nom)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      activeOpacity={0.7}
      alignItems="center"
      height={45}
      justifyContent="center"
      onPress={() => onChange(book)}
      width={wp(99) / 5}
    >
      <Text
        color={isSelected ? 'primary' : isNT ? 'quart' : 'default'}
        fontSize={16}
        fontWeight={isSelected ? 'bold' : 'normal'}
      >
        {bookName}
      </Text>
    </TouchableBox>
  )
}
