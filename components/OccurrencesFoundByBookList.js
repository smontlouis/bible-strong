import React from 'react'
import { FlatList, TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import { Icon } from 'expo'

import books from '@versions/books-desc'
import Box from '@ui/Box'
import Text from '@ui/Text'

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
  versesCountByBook
}) => (
  <Box marginTop={20}>
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
            <Icon.Ionicons name={'ios-arrow-forward'} size={20} />
          </ListItem>
        </TouchableOpacity>
      )}
    />
  </Box>
)

export default OccurrencesFoundByBookList
