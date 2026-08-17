import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MenuView } from '~common/ui/MenuView'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import * as Icon from '@expo/vector-icons'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import Link from '~common/Link'
import SearchInput from '~common/SearchInput'
import Loading from '~common/Loading'
import type { NaveTopicSummary } from '~features/resources/naveAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList'
import SectionTitle from '~common/SectionTitle'
import useLanguage from '~helpers/useLanguage'

import NaveItem from './NaveItem'
import { useSearchValue, useInfiniteResultsByLetterOrSearch } from '../lexique/useUtilities'
import { useTranslation } from 'react-i18next'
import { NaveTab } from '../../state/tabs'
import { PrimitiveAtom } from 'jotai/vanilla'
import { toast } from '~helpers/toast'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import OfflineResourceRecovery from '~features/resources/OfflineResourceRecovery'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'

type NaveRow = NaveTopicSummary
type NaveSection = {
  title: string
  data: NaveRow[]
}

const getNaveItemLayout = sectionListGetItemLayout({
  getItemHeight: () => 60,
  getSectionHeaderHeight: () => 50,
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
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const lang = useLanguage()
  const [naveResourceLanguage, setNaveResourceLanguage] = useResourceLanguage('NAVE')
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()
  const availabilityQuery = useQuery({
    queryKey: resourceQueryKeys.offlineDatabaseAvailability('NAVE', naveResourceLanguage),
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

  if (
    availabilityQuery.data?.status === 'unavailable' &&
    availabilityQuery.data.recoveries.includes('acquire-offline-copy')
  ) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'database', databaseId: 'NAVE', language: naveResourceLanguage }}
        title={t('resource.nave.offlineCopyNeeded')}
        fileSize={7}
        hasBackButton={showBackButton}
        hasHeader
      />
    )
  }

  if (error === 'INVALID_OFFLINE_COPY' && recoveries.includes('acquire-offline-copy')) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'database', databaseId: 'NAVE', language: naveResourceLanguage }}
        title={t('La base Nave doit être retéléchargée.')}
        fileSize={7}
        hasBackButton={showBackButton}
        hasHeader
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

  const toggleNaveLanguage = () => {
    const nextLanguage = naveResourceLanguage === 'fr' ? 'en' : 'fr'
    setNaveResourceLanguage(nextLanguage)
    toast(t('menu.languageChanged', { language: nextLanguage === 'fr' ? 'Français' : 'English' }))
  }

  if (availabilityQuery.isError || error) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box flex bg="reverse">
          <Header hasBackButton={showBackButton} title={t('Désolé...')} />
          <ResourceUnavailableView
            identity={{ kind: 'database', databaseId: 'NAVE', language: naveResourceLanguage }}
            title={t('resource.nave.temporarilyUnavailable')}
            fileSize={7}
            reason="temporary-unavailable"
            onRetry={() => {
              void availabilityQuery.refetch()
              retry()
            }}
          />
        </Box>
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header
          hasBackButton={showBackButton}
          title={t('Thématique Nave')}
          rightComponent={
            <Box row alignItems="center">
              {lang === 'fr' && (
                <Link route="NaveWarning" padding>
                  <Icon.Feather size={20} name="alert-triangle" color="rgb(255,188,0)" />
                </Link>
              )}
              <MenuView
                actions={[
                  {
                    id: 'language',
                    title: `${t('menu.language')}: ${
                      naveResourceLanguage === 'fr' ? 'Français' : 'English'
                    }`,
                    image: 'globe',
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === 'language') toggleNaveLanguage()
                }}
              >
                <Box row center height={60} width={60}>
                  <Icon.Feather name="more-vertical" size={18} />
                </Box>
              </MenuView>
            </Box>
          }
        >
          <Box pb={10} px={20}>
            <SearchInput
              placeholder={t('Recherche par mot')}
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
            <SectionList<NaveRow, NaveSection>
              renderItem={({ item: { normalizedName, name } }) => (
                <NaveItem
                  name_lower={normalizedName}
                  name={name}
                  onSelect={isNewTabSelection || onNaveSelect ? selectNave : undefined}
                />
              )}
              removeClippedSubviews
              maxToRenderPerBatch={100}
              getItemLayout={(data, index) =>
                getNaveItemLayout((data || []) as NaveSection[], index)
              }
              renderSectionHeader={({ section: { title } }) => (
                <SectionTitle color="quint">
                  <Text title fontWeight="bold" fontSize={16} style={{ color: 'white' }}>
                    {title.toUpperCase()}
                  </Text>
                </SectionTitle>
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
