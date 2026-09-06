import * as Icon from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { FlatList, TouchableOpacity } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { pageContentStyle } from '~common/ui/PageContent'
import type { Theme as AppTheme } from '~themes'

import { useLocalSearchParams } from 'expo-router'
import { useSelector } from 'react-redux'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getBook } from '~helpers/bibleBookCatalog'
import { IS_FORM_SHEET } from '~helpers/constants'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { RootState } from '~redux/modules/reducer'

const OccurencesNumber = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'ml-[10px] pr-[4px] pl-[4px] pt-[2px] pb-[2px] rounded-[3px] bg-light-primary',
      className
    )
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const ListItem = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('border-b-[1px] border-b-border', className))
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

const StyledIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('text-default', className))
  return (
    <Icon.Feather
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

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

  const {
    data: result,
    isPending,
    isSuccess,
  } = useQuery({
    queryKey: resourceQueryKeys.strongBibleCounts({
      currentVersionId: requestedStrongBibleVersionId,
      defaultVersionId: defaultStrongBibleVersionId,
      book,
      reference: strongReference.Code,
    }),
    queryFn: () =>
      resources.strongBible.loadCountsByBook({
        currentVersionId: requestedStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        book,
        reference: strongReference.Code,
      }),
    ...localQueryOptions,
  })
  const data = result?.status === 'available' ? result.counts : []
  const sourceVersionId = result?.status === 'available' ? result.provenance.versionId : undefined

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={`Concordance ${strongReference.Code}${sourceVersionId ? ` · ${sourceVersionId}` : ''}`}
      />
      {isPending && <Loading />}
      {isSuccess && (
        <FlatList
          contentContainerStyle={pageContentStyle}
          style={{ marginTop: 5, padding: 20 }}
          removeClippedSubviews
          data={data}
          keyExtractor={item => `book${item.Livre}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
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
              <ListItem className="h-[50px] items-center flex-row">
                <Text className="text-[16px]">
                  {getBook(item.Livre)?.Nom || `Livre ${item.Livre}`}
                </Text>
                <OccurencesNumber>
                  <Text>{item.versesCountByBook}</Text>
                </OccurencesNumber>
                <Box className="overflow-hidden border-continuous flex-[1]" />
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
