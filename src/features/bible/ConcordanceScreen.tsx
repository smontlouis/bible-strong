import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { FlatList, TouchableOpacity } from 'react-native'

import { useLocalSearchParams } from 'expo-router'
import books from '~assets/bible_versions/books-desc'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import { DatabaseError } from '~helpers/catchDatabaseError'
import useAsync from '~helpers/useAsync'
import { localStrongAccess } from '~features/resources/strongAccess'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

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

const hasDatabaseError = (value: unknown): value is DatabaseError =>
  typeof value === 'object' && value !== null && 'error' in value

const ConcordanceScreen = () => {
  const pushRouteOnce = usePushRouteOnce()
  const params = useLocalSearchParams<{ strongReference?: string; book?: string }>()
  const canGoBackInStack = useCanGoBackInStack()

  // Parse params from URL strings
  const strongReference = params.strongReference ? JSON.parse(params.strongReference) : {}
  const book = params.book ? Number(params.book) : 0

  const { data: versesCountByBook, status } = useAsync(
    async () => await localStrongAccess.loadVersesCountByBook(book, strongReference.Code)
  )
  const data = hasDatabaseError(versesCountByBook) ? [] : versesCountByBook

  return (
    <FormSheetScreen isFormSheet>
      <Header hasBackButton={canGoBackInStack} title={`Concordance ${strongReference.Code}`} />
      {status === 'Pending' && <Loading />}
      {status === 'Resolved' && (
        <FlatList
          style={{ marginTop: 5, padding: 20 }}
          removeClippedSubviews
          data={data}
          keyExtractor={item => `book${item.Livre}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                pushRouteOnce({
                  pathname: '/concordance-by-book',
                  params: {
                    book: String(item.Livre),
                    strongReference: JSON.stringify(strongReference),
                  },
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
      )}
    </FormSheetScreen>
  )
}

export default ConcordanceScreen
