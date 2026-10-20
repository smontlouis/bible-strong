import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { ListSectionTitle } from '~common/ui/ListSection'
import FiltersHeader from '~common/FiltersHeader'
import SearchInput from '~common/SearchInput'
import Loading from '~common/Loading'
import type { NaveTopicSummary } from '~features/resources/naveAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList'
import NaveItem, { NAVE_ITEM_HEIGHT } from './NaveItem'
import { useSearchValue, useInfiniteResultsByLetterOrSearch } from '../lexique/useUtilities'
import { useTranslation } from 'react-i18next'
import { getLanguage } from '~i18n'
import { NaveTab } from '../../state/tabs'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableScreen from '~features/resources/ResourceUnavailableScreen'
import {
  resourceFailureFromAccessCode,
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
type NaveRow = NaveTopicSummary
type NaveSection = {
  title: string
  data: NaveRow[]
}

/** A letter title: 16 above, an 18 line, 6 below. */
const SECTION_HEADER_HEIGHT = 40

const getNaveItemLayout = sectionListGetItemLayout({
  getItemHeight: () => NAVE_ITEM_HEIGHT,
  getSectionHeaderHeight: () => SECTION_HEADER_HEIGHT,
  getSeparatorHeight: () => 0,
  getSectionFooterHeight: () => 0,
}) as (data: NaveSection[], index: number) => { length: number; offset: number; index: number }

const useSectionResults = (results: NaveRow[]) => {
  return results.reduce<NaveSection[]>((list, naveItem) => {
    const listItem = list.find(item => item.title === naveItem.initial)
    if (!listItem) {
      list.push({ title: naveItem.initial, data: [naveItem] })
    } else {
      listItem.data.push(naveItem)
    }

    return list
  }, [])
}

interface NaveListScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
  hasBackButton?: boolean
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
  onNaveSelect?: (name_lower: string, name: string) => void
}

const NaveListScreen = ({
  hasBackButton,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
  onNaveSelect,
}: NaveListScreenProps) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const [naveResourceLanguage, setNaveResourceLanguage] = useResourceLanguage('NAVE')
  const appLanguage = getLanguage()
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()
  const availabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.offlineDatabaseAvailability('NAVE', naveResourceLanguage),
      isConnected,
    ],
    queryFn: () =>
      resources.nave.getAvailability?.(naveResourceLanguage) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const { results, isLoading, error, recoveries, retry, fetchNextPage, hasNextPage } =
    useInfiniteResultsByLetterOrSearch(
      {
        queryKey: ['nave'],
        query: (value, options) => resources.nave.searchPage(value, options, naveResourceLanguage),
        value: debouncedSearchValue,
        resourceLanguage: naveResourceLanguage,
      },
      {
        queryKey: ['nave'],
        query: (value, options) =>
          resources.nave.listByLetterPage(value, options, naveResourceLanguage),
        value: letter,
        resourceLanguage: naveResourceLanguage,
      }
    )
  const naveResults = Array.isArray(results) ? (results as NaveRow[]) : []
  const sectionResults = useSectionResults(naveResults)

  if (availabilityQuery.data?.status === 'unavailable') {
    return (
      <ResourceUnavailableScreen
        headerTitle={t('Désolé...')}
        hasBackButton={showBackButton}
        isFormSheet={isFormSheet}
        identity={{ kind: 'database', databaseId: 'NAVE', language: naveResourceLanguage }}
        title={t('resource.nave.offlineCopyNeeded')}
        offlineTitle={t('resource.nave.temporarilyUnavailable')}
        fileSize={7}
        failure={resourceFailureFromAvailability(availabilityQuery.data)}
        onRetry={() => {
          void availabilityQuery.refetch()
          retry()
        }}
      />
    )
  }

  const selectNave = (nameLower: string, name: string) => {
    if (isNewTabSelection) {
      resolveNewTabSelection({
        id: newTabId || 'new',
        title: name,
        isRemovable: true,
        type: 'nave',
        data: {
          name_lower: nameLower,
          name,
        },
      })
      return
    }

    onNaveSelect?.(nameLower, name)
  }

  if (availabilityQuery.isError || error) {
    return (
      <ResourceUnavailableScreen
        headerTitle={t('Désolé...')}
        hasBackButton={showBackButton}
        isFormSheet={isFormSheet}
        identity={{ kind: 'database', databaseId: 'NAVE', language: naveResourceLanguage }}
        title={t('resource.nave.temporarilyUnavailable')}
        fileSize={7}
        failure={
          error
            ? resourceFailureFromAccessCode(error, recoveries)
            : resourceFailureFromAccessError(availabilityQuery.error)
        }
        onRetry={() => {
          void availabilityQuery.refetch()
          retry()
        }}
      />
    )
  }

  return (
    // The letter bar sits fixed under the list: while it shows, the page stays above the home
    // indicator and the tab bar.
    <FormSheetScreen isFormSheet={isFormSheet} reserveBottom={!searchValue}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <FiltersHeader
          hasBackButton={showBackButton}
          title={t('Thématique Nave')}
          onReset={() => setNaveResourceLanguage(appLanguage)}
          filters={[
            {
              key: 'language',
              icon: 'globe',
              label: t('menu.language'),
              value: t(`versionCatalog.language.${naveResourceLanguage}`),
              active: naveResourceLanguage !== appLanguage,
              onPress: () => {},
              options: (['fr', 'en'] as const).map(language => ({
                key: language,
                label: t(`versionCatalog.language.${language}`),
                selected: naveResourceLanguage === language,
                onSelect: () => setNaveResourceLanguage(language),
              })),
            },
          ]}
        >
          <Box className="overflow-hidden border-continuous pb-[10px] px-[20px]">
            <SearchInput
              placeholder={t('Recherche par mot')}
              onChangeText={setSearchValue}
              value={searchValue}
              onDelete={() => setSearchValue('')}
            />
          </Box>
        </FiltersHeader>
        <Box className="overflow-hidden border-continuous flex-[1]">
          {isLoading ? (
            <Loading message={t('Chargement...')} />
          ) : sectionResults.length ? (
            <SectionList<NaveRow, NaveSection>
              renderItem={({ item: { normalizedName, name }, index, section }) => (
                <NaveItem
                  name_lower={normalizedName}
                  name={name}
                  onSelect={isNewTabSelection || onNaveSelect ? selectNave : undefined}
                  hasSeparator={index < section.data.length - 1}
                />
              )}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={(data, index) =>
                getNaveItemLayout((data || []) as NaveSection[], index)
              }
              renderSectionHeader={({ section: { title } }) => (
                <Box className="bg-reverse" style={{ height: SECTION_HEADER_HEIGHT }}>
                  <ListSectionTitle className="ml-[20px] mt-[16px] mb-[6px] leading-[18px]">
                    {title.toUpperCase()}
                  </ListSectionTitle>
                </Box>
              )}
              stickySectionHeadersEnabled
              sections={sectionResults}
              keyExtractor={(item: NaveRow) => item.normalizedName}
              onEndReached={() => {
                if (hasNextPage) fetchNextPage()
              }}
              onEndReachedThreshold={0.5}
            />
          ) : (
            <Empty
              icon={require('~assets/images/empty-state-icons/word.svg')}
              message={t('Aucun mot trouvé...')}
            />
          )}
        </Box>
        {!searchValue && <AlphabetList color="quint" letter={letter} setLetter={setLetter} />}
      </Box>
    </FormSheetScreen>
  )
}

export default NaveListScreen
