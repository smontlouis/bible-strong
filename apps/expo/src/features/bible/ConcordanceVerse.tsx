import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import type { TextStyle } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import type { StrongVerseTextStyle } from './BibleStrongReference'
import CanonicalStrongVerseText from './CanonicalStrongVerseText'

import type { TFunction } from 'react-i18next'
import type { Verse } from '~common/types'

const VerseText = (
  componentProps: Omit<UIComponentProps<typeof View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-[1] flex-wrap items-start flex-row', className)
  return (
    <View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof View>['style']}
    />
  )
}

const Container = (
  componentProps: Omit<UIComponentProps<typeof TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('pt-[10px] pb-[10px]', className)
  return (
    <TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof TouchableOpacity>['style']}
    />
  )
}

type Props = {
  /** Classes of the row, after its defaults, such as the margin of a card's row. */
  className?: string
  /** A hairline under the row. A card or a list that draws its own separators leaves it out. */
  separated?: boolean
  onOpenVerse: (verse: Verse) => void
  t: TFunction<'translation', undefined>
  verse: Verse
  concordanceFor: string
  textStyle?: StrongVerseTextStyle
  referenceTextStyle?: TextStyle
}

const ConcordanceVerse = ({
  className,
  separated = true,
  verse,
  onOpenVerse,
  t,
  concordanceFor,
  textStyle,
  referenceTextStyle,
}: Props) => {
  const stylingTheme = useStylingTheme()

  const bookNumber = Number(verse.Livre)
  const chapterNumber = Number(verse.Chapitre)
  const verseNumber = Number(verse.Verset)
  const book = getBook(bookNumber)
  const bookName = t(book?.Nom || 'Livre {{bookNumber}}', book ? undefined : { bookNumber })

  return (
    <Container
      className={twMerge(separated && 'border-b-separator', className)}
      style={separated ? { borderBottomWidth: StyleSheet.hairlineWidth } : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${bookName} ${chapterNumber}:${verseNumber}`}
      onPress={() => onOpenVerse(verse)}
    >
      <Text
        className="text-[16px] mb-[5px]"
        style={{
          fontFamily: textStyle?.fontFamily || resolveFontFamily(stylingTheme.fontFamily.title),
          ...referenceTextStyle,
        }}
      >
        {bookName} {chapterNumber}:{verseNumber}
      </Text>
      <VerseText>
        <CanonicalStrongVerseText
          verse={{ ...verse, Livre: bookNumber }}
          concordanceFor={concordanceFor}
          small
          textStyle={textStyle}
        />
      </VerseText>
    </Container>
  )
}

export default ConcordanceVerse
