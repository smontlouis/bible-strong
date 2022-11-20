import React from 'react'
import { withNavigation } from 'react-navigation'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'
import compose from 'recompose/compose'
import { withTheme } from '@emotion/react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import books from '~assets/bible_versions/books-desc'
import LocalSearchItem from './LocalSearchItem'
import { bibleLSG } from './LocalSearchScreen'
import LexiqueResultsWidget from '~features/lexique/LexiqueResultsWidget'
import DictionnaryResultsWidget from '~features/dictionnary/DictionnaryResultsWidget'
import NaveResultsWidget from '~features/nave/NaveResultsWidget'
import { useTranslation } from 'react-i18next'
import VerseResultWidget from '~features/bible/VerseResultWidget'

const LocalSearchResults = ({
  results = [],
  searchValue,
  navigation,
  theme,
}) => {
  const { t } = useTranslation()

  const nbResults = results.length

  return (
    <KeyboardAwareFlatList
      ListHeaderComponent={
        <Box>
          <Box row wrap paddingVertical={20}>
            <LexiqueResultsWidget searchValue={searchValue} />
            <DictionnaryResultsWidget searchValue={searchValue} />
            <NaveResultsWidget searchValue={searchValue} />
            <VerseResultWidget searchValue={searchValue} />
          </Box>
          <Box>
            <Text title fontSize={16} color="grey">
              {t('{{nbHits}} occurences trouvées dans la bible', {
                nbHits: nbResults,
              })}
            </Text>
          </Box>
        </Box>
      }
      enableOnAndroid={true}
      keyboardShouldPersistTaps={'handled'}
      enableResetScrollToCoords={false}
      style={{
        padding: 20,
        paddingTop: 0,
        paddingBottom: 40,
        flex: 1,
        backgroundColor: theme.colors.reverse,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }}
      removeClippedSubviews
      data={results}
      keyExtractor={result => result.ref}
      renderItem={({ item: result, index }) => {
        const [book, chapter, verse] = result.ref.split('-')
        const { title } = formatVerseContent([
          { Livre: book, Chapitre: chapter, Verset: verse },
        ])
        const metaData = result.matchData.metadata
        const positions = Object.keys(metaData)
          .reduce((acc, item) => acc.concat(metaData[item]?.text?.position), [])
          .filter(x => x)
        positions.sort((a, b) => a[0] - b[0])

        const text = bibleLSG[book][chapter][verse]

        if (!text) {
          return null
        }

        return (
          <LocalSearchItem
            key={result.ref}
            positions={positions}
            reference={title}
            text={text}
            onPress={() =>
              navigation.navigate('BibleView', {
                isReadOnly: true,
                book: books[book - 1],
                chapter: Number(chapter),
                verse: Number(verse),
              })
            }
          />
        )
      }}
    />
  )
}

export default compose(withNavigation, withTheme)(LocalSearchResults)
