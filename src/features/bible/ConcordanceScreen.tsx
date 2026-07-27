import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { FlatList, TouchableOpacity } from 'react-native'

import { useLocalSearchParams } from 'expo-router'
import { getBook } from '~helpers/bibleBookCatalog'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import useAsync from '~helpers/useAsync'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { IS_FORM_SHEET } from '~helpers/constants'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'

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

const ConcordanceScreen = () => {
  const pushRouteOnce = usePushRouteOnce()
  const resources = useResourceAccess()
  const params = useLocalSearchParams<{
    strongReference?: string
    book?: string
    strongBibleVersionId?: string
  }>()
  const isFormSheet = IS_FORM_SHEET
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true

  // Parse params from URL strings
  const strongReference = params.strongReference ? JSON.parse(params.strongReference) : {}
  const book = params.book ? Number(params.book) : 0
  const defaultStrongBibleVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const requestedStrongBibleVersionId =
    (params.strongBibleVersionId as StrongBibleVersionId | undefined) ?? defaultStrongBibleVersionId

  const { data: result, status } = useAsync(
    [
      'strong-counts-by-book',
      requestedStrongBibleVersionId,
      defaultStrongBibleVersionId,
      book,
      strongReference.Code,
    ],
    () =>
      resources.strongBible.loadCountsByBook({
        currentVersionId: requestedStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        book,
        reference: strongReference.Code,
      })
  )
  const data = result?.status === 'available' ? result.counts : []
  const sourceVersionId = result?.status === 'available' ? result.provenance.versionId : undefined

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={`Concordance ${strongReference.Code}${sourceVersionId ? ` · ${sourceVersionId}` : ''}`}
      />
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
                    strongBibleVersionId: sourceVersionId,
                  },
                })
              }}
            >
              <ListItem row alignItems="center" height={50}>
                <Text fontSize={16}>{getBook(item.Livre)?.Nom || `Livre ${item.Livre}`}</Text>
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
