import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MenuView } from '~common/ui/MenuView'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import AlphabetList from '~common/AlphabetList'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import SectionTitle from '~common/SectionTitle'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import { getFirstLetterFrom } from '~helpers/alphabet'

import { useInfiniteResultsByLetterOrSearch, useSearchValue } from './useUtilities'

import { useTranslation } from 'react-i18next'
import LexiqueItem from './LexiqueItem'
import { FeatherIcon } from '~common/ui/Icon'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableScreen from '~features/resources/ResourceUnavailableScreen'
import {
  resourceFailureFromAccessCode,
  resourceFailureFromAccessError,
  resourceFailureFromStrongModuleAvailability,
} from '~features/resources/resourceFailure'

interface LexiqueSection {
  title: string
  data: StrongLexiconSearchResult[]
}

const getLexiqueItemLayout = sectionListGetItemLayout({
  getItemHeight: () => 80,
  getSectionHeaderHeight: () => 50,
  getSeparatorHeight: () => 0,
  getSectionFooterHeight: () => 0,
})

const useSectionResults = (results: StrongLexiconSearchResult[]) => {
  return results.reduce<LexiqueSection[]>((list, dbItem) => {
    const initial = getFirstLetterFrom(dbItem.gloss)
    const listItem = list.find(item => item.title && item.title === initial)
    if (!listItem) {
      list.push({ title: initial, data: [dbItem] })
    } else {
      listItem.data.push(dbItem)
    }

    return list
  }, [])
}

interface LexiqueListScreenProps {
  hasBackButton?: boolean
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
  onStrongSelect?: (book: number, reference: string) => void
}

const LexiqueListScreen = ({
  hasBackButton,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
  onStrongSelect,
}: LexiqueListScreenProps) => {
  const { t } = useTranslation()
  const isOnline = useConnection()
  const resources = useResourceAccess()
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const {
    language: strongResourceLanguage,
    menuTitle: strongLanguageMenuTitle,
    toggleLanguage: toggleStrongLanguage,
  } = useStrongLexiconLanguage()
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()
  const coreAvailabilityQuery = useQuery({
    queryKey: resourceQueryKeys.strongLexiconAvailability('core'),
    queryFn: async () => ({
      availability: await resources.strongLexicon.getModuleAvailability('core'),
      recoveries: await resources.strongLexicon.getModuleRecoveryActions?.('core'),
    }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const { results, isLoading, error, recoveries, retry, fetchNextPage, hasNextPage } =
    useInfiniteResultsByLetterOrSearch(
      {
        queryKey: ['strong-lexicon'],
        query: (value, options) =>
          resources.strongLexicon.listEntries({
            language: strongResourceLanguage,
            search: value,
            ...options,
          }),
        value: debouncedSearchValue,
        resourceLanguage: strongResourceLanguage,
      },
      {
        queryKey: ['strong-lexicon'],
        query: (value, options) =>
          resources.strongLexicon.listEntries({
            language: strongResourceLanguage,
            prefix: value,
            ...options,
          }),
        value: letter,
        resourceLanguage: strongResourceLanguage,
      },
      50
    )

  const lexiqueResults = Array.isArray(results) ? results : []
  const sectionResults = useSectionResults(lexiqueResults)

  const selectStrong = (book: number, reference: string, title?: string) => {
    if (isNewTabSelection) {
      resolveNewTabSelection({
        id: newTabId || 'new',
        title: title ? `${title} (${reference})` : t('Lexique'),
        isRemovable: true,
        type: 'strong',
        data: {
          book,
          reference,
        },
      })
      return
    }

    onStrongSelect?.(book, reference)
  }

  if (
    coreAvailabilityQuery.data &&
    coreAvailabilityQuery.data.availability.status !== 'available'
  ) {
    const isOffline = !isOnline
    return (
      <ResourceUnavailableScreen
        headerTitle={t('Désolé...')}
        hasBackButton={showBackButton}
        isFormSheet={isFormSheet}
        identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
        title={t(
          isOffline ? 'resource.strong.temporarilyUnavailable' : 'resource.strong.offlineCopyNeeded'
        )}
        fileSize={35}
        failure={
          isOffline
            ? { cause: 'network-offline', recoveries: ['retry'] }
            : resourceFailureFromStrongModuleAvailability(
                coreAvailabilityQuery.data.availability,
                coreAvailabilityQuery.data.recoveries
              )
        }
        onRetry={
          isOffline
            ? () => {
                void coreAvailabilityQuery.refetch()
                retry()
              }
            : undefined
        }
      />
    )
  }

  if (coreAvailabilityQuery.isError || error) {
    return (
      <ResourceUnavailableScreen
        headerTitle={t('Désolé...')}
        hasBackButton={showBackButton}
        isFormSheet={isFormSheet}
        identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
        title={t('resource.strong.temporarilyUnavailable')}
        fileSize={35}
        failure={
          error
            ? resourceFailureFromAccessCode(error, recoveries)
            : resourceFailureFromAccessError(coreAvailabilityQuery.error)
        }
        onRetry={() => {
          void coreAvailabilityQuery.refetch()
          retry()
        }}
      />
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header
          hasBackButton={showBackButton}
          title={t('Lexique')}
          rightComponent={
            <MenuView
              actions={[
                {
                  id: 'language',
                  title: strongLanguageMenuTitle,
                  image: 'globe',
                },
              ]}
              onPressAction={({ nativeEvent }) => {
                if (nativeEvent.event === 'language') toggleStrongLanguage()
              }}
            >
              <Box row center height={60} width={60}>
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            </MenuView>
          }
        >
          <Box pb={10} px={20}>
            <SearchInput
              placeholder={t('Recherche par code ou par mot')}
              onChangeText={setSearchValue}
              value={searchValue}
              onDelete={() => setSearchValue('')}
            />
          </Box>
        </Header>
        <Box flex paddingTop={20}>
          {isLoading ? (
            <Loading message={t('Chargement...')} />
          ) : sectionResults.length ? (
            <SectionList<StrongLexiconSearchResult, LexiqueSection>
              renderItem={({ item }) => (
                <LexiqueItem
                  {...item}
                  onSelect={isNewTabSelection || onStrongSelect ? selectStrong : undefined}
                />
              )}
              removeClippedSubviews
              maxToRenderPerBatch={100}
              getItemLayout={(data, index) =>
                getLexiqueItemLayout((data || []) as LexiqueSection[], index)
              }
              renderSectionHeader={({ section: { title } }) => (
                <SectionTitle color="primary">
                  <Text title fontWeight="bold" fontSize={16} color="reverse">
                    {title}
                  </Text>
                </SectionTitle>
              )}
              stickySectionHeadersEnabled
              sections={sectionResults}
              keyExtractor={item => `${item.id}:${item.stepCode}`}
              onEndReached={() => {
                if (hasNextPage) fetchNextPage()
              }}
              onEndReachedThreshold={0.5}
            />
          ) : (
            <Empty
              icon={require('~assets/images/empty-state-icons/word.svg')}
              message={t('Aucune strong trouvée...')}
            />
          )}
        </Box>
        {!searchValue && <AlphabetList letter={letter} setLetter={setLetter} />}
      </Box>
    </FormSheetScreen>
  )
}

export default LexiqueListScreen
