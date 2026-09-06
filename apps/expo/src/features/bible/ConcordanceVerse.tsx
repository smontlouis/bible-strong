import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import CanonicalStrongVerseText from './CanonicalStrongVerseText'

import type { TFunction } from 'react-i18next'
import type { Verse } from '~common/types'

const VerseText = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-[1] flex-wrap items-start flex-row', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const Container = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('pt-[10px] pb-[10px] border-b-[1px] border-b-border', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

type Props = {
  onOpenVerse: (verse: Verse) => void
  t: TFunction<'translation', undefined>
  verse: Verse
  concordanceFor: string
}

const ConcordanceVerse = ({ verse, onOpenVerse, t, concordanceFor }: Props) => {
  const stylingTheme = useStylingTheme()

  const bookNumber = Number(verse.Livre)
  const chapterNumber = Number(verse.Chapitre)
  const verseNumber = Number(verse.Verset)
  const book = getBook(bookNumber)
  const bookName = t(book?.Nom || 'Livre {{bookNumber}}', book ? undefined : { bookNumber })

  return (
    <Container onPress={() => onOpenVerse(verse)}>
      <Text
        className="text-[16px] mb-[5px]"
        style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
      >
        {bookName} {chapterNumber}:{verseNumber}
      </Text>
      <VerseText>
        <CanonicalStrongVerseText
          verse={{ ...verse, Livre: bookNumber }}
          concordanceFor={concordanceFor}
          small
        />
      </VerseText>
    </Container>
  )
}

export default ConcordanceVerse
