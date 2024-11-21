import { useTheme } from '@emotion/react'
import React from 'react'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'

import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import books from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import VerseResultWidget from '~features/bible/VerseResultWidget'
import DictionnaryResultsWidget from '~features/dictionnary/DictionnaryResultsWidget'
import LexiqueResultsWidget from '~features/lexique/LexiqueResultsWidget'
import NaveResultsWidget from '~features/nave/NaveResultsWidget'
import formatVerseContent from '~helpers/formatVerseContent'
import LocalSearchItem from './LocalSearchItem'
import bibleLSG from './bibleLSG'

const LocalSearchResults = ({ results = [], searchValue }) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const navigation = useNavigation()
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

        const text = bibleLSG.get()[book][chapter][verse]

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

export default LocalSearchResults
