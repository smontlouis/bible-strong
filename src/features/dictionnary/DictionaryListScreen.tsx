import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
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
import type { DictionarySummary } from '~features/resources/dictionaryAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { DictionaryTab } from '../../state/tabs'
import { useResultsByLetterOrSearch, useSearchValue } from '../lexique/useUtilities'
import DictionnaireItem from './DictionnaireItem'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useAtomValue } from 'jotai/react'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import OfflineResourceRecovery from '~features/resources/OfflineResourceRecovery'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'

type DictionaryRow = DictionarySummary

interface DictionarySection {
  title: string
  data: DictionaryRow[]
}

const getDictionaryItemLayout = sectionListGetItemLayout({
  getItemHeight: () => 60,
  getSectionHeaderHeight: () => 50,
  getSeparatorHeight: () => 0,
  getSectionFooterHeight: () => 0,
})

const useSectionResults = (results: DictionaryRow[]) => {
  return results.reduce<DictionarySection[]>((list, dbItem) => {
    const listItem = list.find(
      item => item.title && item.title === getFirstLetterFrom(dbItem.normalizedWord)
    )
    if (!listItem) {
      list.push({
        title: getFirstLetterFrom(dbItem.normalizedWord),
        data: [dbItem],
      })
    } else {
      listItem.data.push(dbItem)
    }

    return list
  }, [])
}

interface DictionaryListScreenProps {
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
  hasBackButton?: boolean
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
  onWordSelect?: (word: string) => void
}

const DictionaryListScreen = ({
  hasBackButton,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
  onWordSelect,
}: DictionaryListScreenProps) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const dictionaryResourceLanguage = useAtomValue(resourcesLanguageAtom).DICTIONNAIRE
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()
  const availabilityQuery = useQuery({
    queryKey: resourceQueryKeys.offlineDatabaseAvailability(
      'DICTIONNAIRE',
      dictionaryResourceLanguage
    ),
    queryFn: () =>
      resources.dictionary.getAvailability?.(dictionaryResourceLanguage) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const { results, isLoading, error, recoveries } = useResultsByLetterOrSearch(
    {
      queryKey: ['dictionary'],
      query: resources.dictionary.search,
      value: debouncedSearchValue,
      resourceLanguage: dictionaryResourceLanguage,
    },
    {
      queryKey: ['dictionary'],
      query: resources.dictionary.listByLetter,
      value: letter,
      resourceLanguage: dictionaryResourceLanguage,
    }
  )

  const dictionaryResults = Array.isArray(results) ? results : []
  const sectionResults = useSectionResults(dictionaryResults)

  if (
    availabilityQuery.data?.status === 'unavailable' &&
    availabilityQuery.data.recoveries.includes('acquire-offline-copy')
  ) {
    return (
      <OfflineResourceRecovery
        identity={{
          kind: 'database',
          databaseId: 'DICTIONNAIRE',
          language: dictionaryResourceLanguage,
        }}
        title={t('La base de données dictionnaire est requise pour accéder à cette page.')}
        fileSize={22}
        hasBackButton={showBackButton}
        hasHeader
      />
    )
  }

  if (error === 'INVALID_OFFLINE_COPY' && recoveries.includes('acquire-offline-copy')) {
    return (
      <OfflineResourceRecovery
        identity={{
          kind: 'database',
          databaseId: 'DICTIONNAIRE',
          language: dictionaryResourceLanguage,
        }}
        title={t('Votre dictionnaire doit être retéléchargé.')}
        fileSize={22}
        hasBackButton={showBackButton}
        hasHeader
      />
    )
  }

  const selectWord = (word: string) => {
    if (isNewTabSelection) {
      resolveNewTabSelection({
        id: newTabId || 'new',
        title: word,
        isRemovable: true,
        type: 'dictionary',
        data: { word },
      })
      return
    }

    onWordSelect?.(word)
  }

  if (error) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box flex bg="reverse">
          <Header hasBackButton={showBackButton} title={t('Désolé...')} />
          <Empty
            icon={require('~assets/images/empty-state-icons/inbox.svg')}
            message={`${t('Impossible de charger le dictionnaire...')}${
              error === 'INVALID_OFFLINE_COPY'
                ? t(
                    '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
                  )
                : ''
            }`}
          />
        </Box>
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header hasBackButton={showBackButton} fontSize={18} title={t('Dictionnaire Westphal')}>
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
            <SectionList<DictionaryRow, DictionarySection>
              renderItem={({ item: { word } }) => (
                <DictionnaireItem
                  word={word}
                  onSelect={isNewTabSelection || onWordSelect ? selectWord : undefined}
                />
              )}
              removeClippedSubviews
              maxToRenderPerBatch={100}
              getItemLayout={(data, index) =>
                getDictionaryItemLayout((data || []) as DictionarySection[], index)
              }
              renderSectionHeader={({ section: { title } }) => (
                <SectionTitle color="secondary">
                  <Text title fontWeight="bold" fontSize={16} color="reverse">
                    {title}
                  </Text>
                </SectionTitle>
              )}
              stickySectionHeadersEnabled
              sections={sectionResults}
              keyExtractor={(item, index) =>
                item.id ? String(item.id) : `${item.normalizedWord}-${item.word}-${index}`
              }
            />
          ) : (
            <Empty
              icon={require('~assets/images/empty-state-icons/word.svg')}
              message={t('Aucun mot trouvé...')}
            />
          )}
        </Box>
        {!searchValue && <AlphabetList color="secondary" letter={letter} setLetter={setLetter} />}
      </Box>
    </FormSheetScreen>
  )
}

export default DictionaryListScreen
