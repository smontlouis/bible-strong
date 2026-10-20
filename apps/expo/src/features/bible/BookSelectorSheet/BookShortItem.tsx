import { twMerge } from '~common/ui/classNames'

import { Book } from '~assets/bible_versions/books-desc'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { wp } from '~helpers/utils'
interface BookShortItemProps {
  book: Book
  /** The book's name in the reading's language. */
  bookName: string
  isSelected: boolean
  isNT: boolean
  onChange: (book: Book) => void
}

export const BookShortItem = ({
  book,
  bookName,
  isSelected,
  isNT,
  onChange,
}: BookShortItemProps) => {
  const shortName = bookName.replace(/\s/g, '').substr(0, 3)

  return (
    <TouchableBox
      className="overflow-hidden border-continuous items-center h-[45px] justify-center"
      testID={`book-selector-grid-book-${book.Numero}`}
      accessibilityLabel={bookName}
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
        {shortName}
      </Text>
    </TouchableBox>
  )
}
