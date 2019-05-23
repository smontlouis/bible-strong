import React from 'react'
import { withNavigation } from 'react-navigation'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'
import compose from 'recompose/compose'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import BibleLSG from '~assets/bible_versions/bible-lsg-1910.json'
import formatVerseContent from '~helpers/formatVerseContent'
import books from '~assets/bible_versions/books-desc'
import SearchItem from './SearchItem'
import Empty from '~common/Empty'

const SearchResults = ({ results, navigation, page, setPage }) => {
  if (!results.length) {
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
      style={{ padding: 20, paddingBottom: 40, flex: 1 }}
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
      renderItem={({ item: result }) => {
        const [book, chapter, verse] = result.ref.split('-')
        const { title } = formatVerseContent([
          { Livre: book, Chapitre: chapter, Verset: verse }
        ])
        const metaData = result.matchData.metadata
        const positions = Object.keys(metaData).reduce(
          (acc, item) => acc.concat(metaData[item].LSG.position),
          []
        )
        positions.sort((a, b) => a[0] - b[0])
        return (
          <SearchItem
            key={result.ref}
            positions={positions}
            reference={title}
            text={BibleLSG[book][chapter][verse]}
            onPress={() =>
              navigation.navigate('BibleView', {
                isReadOnly: true,
                book: books[book - 1],
                chapter: Number(chapter),
                verse: Number(verse)
              })
            }
          />
        )
      }}
    />
  )
}

export default compose(withNavigation)(SearchResults)
