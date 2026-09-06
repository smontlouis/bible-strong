import { twMerge } from '~common/ui/classNames'

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
      className="overflow-hidden border-continuous items-center h-[45px] justify-center"
      testID={`book-selector-grid-book-${book.Numero}`}
      accessibilityLabel={t(book.Nom)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      activeOpacity={0.7}
      onPress={() => onChange(book)}
      style={{ width: wp(99) / 5 }}
    >
      <Text
        className={twMerge(
          isSelected ? 'text-primary' : isNT ? 'text-quart' : 'text-default',
          'text-[16px]'
        )}
        style={{ fontWeight: isSelected ? 'bold' : 'normal' }}
      >
        {bookName}
      </Text>
    </TouchableBox>
  )
}
