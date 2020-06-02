import React from 'react'
import { FlatList, TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import loadStrongVersesCountByBook from '~helpers/loadStrongVersesCountByBook'
import books from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Loading from '~common/Loading'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import useAsync from '~helpers/useAsync'
import { NavigationStackProp } from 'react-navigation-stack'
import ScrollView from '~common/ui/ScrollView'

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

interface Props {
  navigation: NavigationStackProp<any>
}

const ConcordanceScreen = ({ navigation }: Props) => {
  const strongReference = navigation.getParam('strongReference', {})
  const book = navigation.getParam('book', 0)

  const { data: versesCountByBook, status } = useAsync(
    async () => await loadStrongVersesCountByBook(book, strongReference.Code)
  )

  return (
    <Container>
      <Header title={`Concordance ${strongReference.Code}`} hasBackButton />
      {status === 'Pending' && <Loading />}
      {status === 'Resolved' && (
        <ScrollView>
          <Box p={20}>
            <FlatList
              style={{ marginTop: 5 }}
              removeClippedSubviews
              data={versesCountByBook}
              keyExtractor={item => `book${item.Livre}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate({
                      routeName: 'ConcordanceByBook',
                      params: {
                        book: item.Livre,
                        strongReference,
                      },
                      key: `concordance-${strongReference.Code}-${item.Livre}`,
                    })
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
          </Box>
        </ScrollView>
      )}
    </Container>
  )
}

export default ConcordanceScreen
