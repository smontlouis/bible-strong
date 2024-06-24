import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { FlatList, TouchableOpacity } from 'react-native'

import { StackScreenProps } from '@react-navigation/stack'
import books from '~assets/bible_versions/books-desc'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import loadStrongVersesCountByBook from '~helpers/loadStrongVersesCountByBook'
import useAsync from '~helpers/useAsync'
import { MainStackProps } from '~navigation/type'

const OccurencesNumber = styled.View(({ theme }) => ({
  marginLeft: 10,
  paddingRight: 4,
  paddingLeft: 4,
  paddingTop: 2,
  paddingBottom: 2,
  borderRadius: 3,
  backgroundColor: theme.colors.lightPrimary,
}))

const ListItem = styled(Box)(({ theme }) => ({
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const ConcordanceScreen = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'Concordance'>) => {
  const strongReference = route.params.strongReference || {}
  const book = route.params.book || 0

  const { data: versesCountByBook, status } = useAsync(
    async () => await loadStrongVersesCountByBook(book, strongReference.Code)
  )

  return (
    <Container>
      <Header title={`Concordance ${strongReference.Code}`} hasBackButton />
      {status === 'Pending' && <Loading />}
      {status === 'Resolved' && (
        <FlatList
          style={{ marginTop: 5, padding: 20 }}
          removeClippedSubviews
          data={versesCountByBook}
          keyExtractor={item => `book${item.Livre}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('ConcordanceByBook', {
                  book: item.Livre,
                  strongReference,
                })

                // navigation.navigate({
                //   routeName: 'ConcordanceByBook',
                //   params: {
                //     book: item.Livre,
                //     strongReference,
                //   },
                //   key: `concordance-${strongReference.Code}-${item.Livre}`,
                // })
              }}
            >
              <ListItem row alignItems="center" height={50}>
                <Text fontSize={16}>{books[item.Livre - 1].Nom}</Text>
                <OccurencesNumber>
                  <Text>{item.versesCountByBook}</Text>
                </OccurencesNumber>
                <Box flex />
                <StyledIcon name="chevron-right" size={20} />
              </ListItem>
            </TouchableOpacity>
          )}
        />
      )}
    </Container>
  )
}

export default ConcordanceScreen
