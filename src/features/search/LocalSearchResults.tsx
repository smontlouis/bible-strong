import React from 'react'
import { withNavigation } from 'react-navigation'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'
import compose from 'recompose/compose'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import books from '~assets/bible_versions/books-desc'
import LocalSearchItem from './LocalSearchItem'
import Empty from '~common/Empty'
import { bibleLSG } from './LocalSearchScreen'

const LocalSearchResults = ({ results, navigation, page, setPage, theme }) => {
  if (!results || !results.length) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message="Désolé je n'ai rien trouvé..."
      />
    )
  }

  const nbResults = results.length

  return (
    <KeyboardAwareFlatList
      enableOnAndroid={true}
      keyboardShouldPersistTaps={'handled'}
      enableResetScrollToCoords={false}
      style={{
        padding: 20,
        paddingBottom: 40,
        flex: 1,
        backgroundColor: theme.colors.reverse,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }}
      removeClippedSubviews
      data={results}
      ListHeaderComponent={
        <Box marginBottom={10}>
          <Text title fontSize={20}>
            {nbResults} occurences trouvées
          </Text>
        </Box>
      }
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
