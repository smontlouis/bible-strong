import React from 'react'
import { FlatList, TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import { Icon } from 'expo'

import books from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Loading from '~common/Loading'

const OccurencesNumber = styled.View(({ theme }) => ({
  marginLeft: 10,
  paddingRight: 4,
  paddingLeft: 4,
  paddingTop: 2,
  paddingBottom: 2,
  borderRadius: 3,
  backgroundColor: theme.colors.primary
}))

const ListItem = styled(Box)(({ theme }) => ({
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border
}))

const OccurrencesFoundByBookList = ({
  strongReference,
  navigation,
  versesCountByBook,
  loading
}) => (
  <Box marginTop={20}>
    {loading ? (
      <Box style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10 }}>
        <Text darkGrey fontSize={16} marginRight={10}>
          Concordance
        </Text>
        <Loading style={{ flex: 0 }} />
      </Box>
    ) : (
      <Box>
        <Text darkGrey fontSize={16} marginBottom={3}>
          Concordance
        </Text>
        <FlatList
          style={{ marginTop: 5 }}
          removeClippedSubviews
          data={versesCountByBook}
          keyExtractor={item => `book${item.Livre}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('ConcordanceByBook', {
                  book: item.Livre,
                  strongReference
                })
              }
            >
              <ListItem row alignItems='center' height={50}>
                <Text fontSize={16}>{books[item.Livre - 1].Nom}</Text>
                <OccurencesNumber>
                  <Text reverse>{item.versesCountByBook}</Text>
                </OccurencesNumber>
                <Box flex />
                <Icon.Feather name='chevron-right' size={20} />
              </ListItem>
            </TouchableOpacity>
          )}
        />
      </Box>
    )}
  </Box>
)

export default OccurrencesFoundByBookList
