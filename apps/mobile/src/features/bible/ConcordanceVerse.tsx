import styled from '@emotion/native'

import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import CanonicalStrongVerseText from './CanonicalStrongVerseText'

import type { TFunction } from 'react-i18next'
import type { Verse } from '~common/types'

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  flexDirection: 'row',
}))

const Container = styled.TouchableOpacity(({ theme }) => ({
  paddingTop: 10,
  paddingBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

type Props = {
  onOpenVerse: (verse: Verse) => void
  t: TFunction<'translation', undefined>
  verse: Verse
  concordanceFor: string
}

const ConcordanceVerse = ({ verse, onOpenVerse, t, concordanceFor }: Props) => {
  const bookNumber = Number(verse.Livre)
  const chapterNumber = Number(verse.Chapitre)
  const verseNumber = Number(verse.Verset)
  const book = getBook(bookNumber)
  const bookName = t(book?.Nom || 'Livre {{bookNumber}}', book ? undefined : { bookNumber })

  return (
    <Container onPress={() => onOpenVerse(verse)}>
      <Text title fontSize={16} marginBottom={5}>
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
