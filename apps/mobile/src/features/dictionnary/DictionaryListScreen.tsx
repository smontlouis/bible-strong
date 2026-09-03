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
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { FeatherIcon } from '~common/ui/Icon'
import { getFirstLetterFrom } from '~helpers/alphabet'
import {
  getDefaultDictionaryWork,
  type DictionaryDirectoryItem,
  type DictionarySummary,
  type DictionaryWork,
} from '~features/resources/dictionaryAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { DictionaryTab } from '../../state/tabs'
import { useInfiniteResultsByLetterOrSearch, useSearchValue } from '../lexique/useUtilities'
import DictionnaireItem from './DictionnaireItem'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useAtom } from 'jotai/react'
import { useResourceLanguage } from '~state/resourcesLanguage'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableScreen from '~features/resources/ResourceUnavailableScreen'
import {
  resourceFailureFromAccessCode,
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { toast } from '~helpers/toast'

type DictionaryRow = DictionarySummary | DictionaryDirectoryItem

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
      item =>
        item.title &&
        item.title ===
          getFirstLetterFrom(
            'normalizedLabel' in dbItem ? dbItem.normalizedLabel : dbItem.normalizedWord
          )
    )
    if (!listItem) {
      list.push({
        title: getFirstLetterFrom(
          'normalizedLabel' in dbItem ? dbItem.normalizedLabel : dbItem.normalizedWord
        ),
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
  dictionaryAtom,
  hasBackButton,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
  onWordSelect,
}: DictionaryListScreenProps) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const pushRouteOnce = usePushRouteOnce()
  const isConnected = useConnection()
  const [dictionaryResourceLanguage, setDictionaryResourceLanguage] =
    useResourceLanguage('DICTIONNAIRE')
  const [dictionaryTab, setDictionaryTab] = useAtom(dictionaryAtom)
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()
  const dictionaryCatalogQuery = useQuery({
    queryKey: ['dictionary-catalog', dictionaryResourceLanguage, isConnected],
    queryFn: () => resources.dictionary.listWorks?.(dictionaryResourceLanguage) ?? [],
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  })
  const defaultWork = getDefaultDictionaryWork(dictionaryResourceLanguage)
  const fallbackDictionary: DictionaryWork = {
    resource: {
      kind: 'dictionary',
      work: defaultWork,
      language: dictionaryResourceLanguage,
      revision: 'legacy',
    },
    resourceId: dictionaryResourceLanguage === 'en' ? 'EASTON_WEBSTER' : 'WESTPHAL',
    title:
      dictionaryResourceLanguage === 'en'
        ? 'Easton’s Bible Dictionary & Webster’s 1828 Dictionary'
        : 'Dictionnaire encyclopédique de la Bible',
    abbreviation: dictionaryResourceLanguage === 'en' ? 'Easton + Webster 1828' : 'Westphal',
    authors:
      dictionaryResourceLanguage === 'en'
        ? ['Matthew George Easton', 'Noah Webster']
        : ['Alexandre Westphal et collaborateurs'],
    description: '',
    edition: '',
    source: 'Bible Strong',
    attribution: '',
    onlineAccess: true,
    offlineDownload: true,
  }
  const catalogDictionaries = dictionaryCatalogQuery.data ?? []
  const directoryRequested = dictionaryTab.data.directory ?? true
  const directoryMode = directoryRequested
  const storedDictionary =
    dictionaryTab.data.work &&
    dictionaryTab.data.resourceId &&
    dictionaryTab.data.language === dictionaryResourceLanguage
      ? {
          ...fallbackDictionary,
          resource: {
            ...fallbackDictionary.resource,
            work: dictionaryTab.data.work,
          },
          resourceId: dictionaryTab.data.resourceId,
          title: dictionaryTab.data.dictionaryTitle ?? dictionaryTab.data.work,
          abbreviation: dictionaryTab.data.dictionaryTitle ?? dictionaryTab.data.work,
        }
      : undefined
  const selectedDictionary =
    catalogDictionaries.find(item => item.resource.work === dictionaryTab.data.work) ??
    storedDictionary ??
    catalogDictionaries.find(item => item.resource.work === defaultWork) ??
    fallbackDictionary
  const selectedWork = selectedDictionary.resource.work
  const hasDedicatedIdentity = selectedDictionary !== fallbackDictionary
  const offlineIdentity = directoryMode
    ? ({ kind: 'dictionary-directory' as const } as const)
    : hasDedicatedIdentity
      ? ({
          kind: 'dictionary' as const,
          work: selectedWork,
          resourceId: selectedDictionary.resourceId,
          language: dictionaryResourceLanguage,
        } as const)
      : ({
          kind: 'database' as const,
          databaseId: 'DICTIONNAIRE' as const,
          language: dictionaryResourceLanguage,
        } as const)
  const availabilityQuery = useQuery({
    queryKey: [
      'dictionary-availability',
      selectedWork,
      dictionaryResourceLanguage,
      directoryMode,
      isConnected,
    ],
    queryFn: () =>
      directoryMode
        ? (resources.dictionary.getDirectoryAvailability?.() ??
          Promise.resolve({ status: 'available' as const }))
        : (resources.dictionary.getAvailability?.(dictionaryResourceLanguage, selectedWork) ??
          Promise.resolve({ status: 'available' as const })),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const { results, isLoading, error, recoveries, retry, fetchNextPage, hasNextPage } =
    useInfiniteResultsByLetterOrSearch<DictionaryRow>(
      {
        queryKey: ['dictionary'],
        query: directoryMode
          ? resources.dictionary.searchDirectoryPage
          : resources.dictionary.searchPage,
        value: debouncedSearchValue,
        resourceLanguage: dictionaryResourceLanguage,
        resourceWork: directoryMode ? undefined : selectedWork,
      },
      {
        queryKey: ['dictionary'],
        query: directoryMode
          ? resources.dictionary.browseDirectoryPage
          : resources.dictionary.listByLetterPage,
        value: letter,
        resourceLanguage: dictionaryResourceLanguage,
        resourceWork: directoryMode ? undefined : selectedWork,
      }
    )

  const dictionaryResults = Array.isArray(results) ? results : []
  const sectionResults = useSectionResults(dictionaryResults)

  const resetBrowseState = () => {
    setLetter('a')
    setSearchValue('')
  }

  const selectLanguage = (language: 'fr' | 'en') => {
    if (language === dictionaryResourceLanguage) return
    resetBrowseState()
    setDictionaryResourceLanguage(language)
    setDictionaryTab(current => ({
      ...current,
      title: t('Dictionnaire'),
      data: {
        ...current.data,
        word: undefined,
        entryId: undefined,
        correspondenceId: undefined,
        work: undefined,
        resourceId: undefined,
        dictionaryTitle: undefined,
        language,
        directory: true,
      },
    }))
    toast(
      t('menu.languageChanged', {
        language: t(
          language === 'fr' ? 'versionCatalog.language.fr' : 'versionCatalog.language.en'
        ),
      })
    )
  }

  const selectDirectory = () => {
    resetBrowseState()
    setDictionaryTab(current => ({
      ...current,
      title: t('Dictionnaire'),
      data: { ...current.data, word: undefined, directory: true },
    }))
  }

  const selectDictionary = (dictionary: DictionaryWork) => {
    resetBrowseState()
    setDictionaryTab(current => ({
      ...current,
      title: t('Dictionnaire'),
      data: {
        ...current.data,
        word: undefined,
        entryId: undefined,
        correspondenceId: undefined,
        work: dictionary.resource.work,
        resourceId: dictionary.resourceId,
        dictionaryTitle: dictionary.title,
        language: dictionary.resource.language,
        directory: false,
      },
    }))
  }

  if (availabilityQuery.data?.status === 'unavailable') {
    return (
      <ResourceUnavailableScreen
        headerTitle={t('Désolé...')}
        hasBackButton={showBackButton}
        isFormSheet={isFormSheet}
        identity={offlineIdentity}
        title={t('resource.dictionary.offlineCopyNeeded')}
        offlineTitle={t('resource.dictionary.temporarilyUnavailable')}
        fileSize={22}
        failure={resourceFailureFromAvailability(availabilityQuery.data)}
        onRetry={() => {
          void availabilityQuery.refetch()
          retry()
        }}
      />
    )
  }

  const selectWord = (
    word: string,
    dictionary = selectedDictionary,
    entryId?: number,
    correspondenceId?: string
  ) => {
    setDictionaryTab(current => ({
      ...current,
      data: {
        ...current.data,
        word,
        work: dictionary.resource.work,
        resourceId: dictionary.resourceId,
        dictionaryTitle: dictionary.title,
        language: dictionary.resource.language,
        directory: directoryMode,
        entryId,
        correspondenceId,
      },
    }))
    if (isNewTabSelection) {
      resolveNewTabSelection({
        id: newTabId || 'new',
        title: word,
        isRemovable: true,
        type: 'dictionary',
        data: {
          word,
          work: dictionary.resource.work,
          resourceId: dictionary.resourceId,
          dictionaryTitle: dictionary.title,
          language: dictionary.resource.language,
          directory: directoryMode,
          entryId,
          correspondenceId,
        },
      })
      return
    }

    if (onWordSelect) {
      onWordSelect(word)
      return
    }

    pushRouteOnce({
      pathname: '/dictionnary-detail',
      params: {
        word,
        work: dictionary.resource.work,
        resourceId: dictionary.resourceId,
        dictionaryTitle: dictionary.title,
        language: dictionary.resource.language,
        ...(entryId !== undefined ? { entryId: String(entryId) } : {}),
        ...(correspondenceId ? { correspondenceId } : {}),
      },
    })
  }

  if (availabilityQuery.isError || error) {
    return (
      <ResourceUnavailableScreen
        headerTitle={t('Désolé...')}
        hasBackButton={showBackButton}
        isFormSheet={isFormSheet}
        identity={offlineIdentity}
        title={t('resource.dictionary.temporarilyUnavailable')}
        fileSize={22}
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
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header
          hasBackButton={showBackButton}
          fontSize={18}
          title={t('Dictionnaire')}
          rightComponent={
            <MenuView
              actions={
                [
                  {
                    id: 'language',
                    title: `${t('menu.language')}: ${t(
                      dictionaryResourceLanguage === 'fr'
                        ? 'versionCatalog.language.fr'
                        : 'versionCatalog.language.en'
                    )}`,
                    image: 'globe',
                  },
                  {
                    id: 'dictionary-source',
                    title: `${t('Dictionnaire')}: ${
                      directoryRequested ? t('Tous') : selectedDictionary.abbreviation
                    }`,
                    image: 'book',
                    subactions: [
                      {
                        id: 'directory',
                        title: t('Tous les dictionnaires'),
                        state: directoryRequested ? ('on' as const) : undefined,
                      },
                      ...catalogDictionaries.map(dictionary => ({
                        id: `dictionary:${dictionary.resource.work}`,
                        title: dictionary.abbreviation,
                        state:
                          !directoryRequested && dictionary.resource.work === selectedWork
                            ? ('on' as const)
                            : undefined,
                      })),
                    ],
                  },
                ] satisfies MenuAction[]
              }
              onPressAction={({ nativeEvent }) => {
                if (nativeEvent.event === 'language') {
                  selectLanguage(dictionaryResourceLanguage === 'fr' ? 'en' : 'fr')
                  return
                }
                if (nativeEvent.event === 'directory') {
                  selectDirectory()
                  return
                }
                if (nativeEvent.event.startsWith('dictionary:')) {
                  const work = nativeEvent.event.slice('dictionary:'.length)
                  const dictionary = catalogDictionaries.find(item => item.resource.work === work)
                  if (dictionary) selectDictionary(dictionary)
                }
              }}
              accessibilityLabel={t('Options du dictionnaire')}
            >
              <Box row center height={60} width={60}>
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            </MenuView>
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
            <SectionList<DictionaryRow, DictionarySection>
              renderItem={({ item }) => {
                if ('sources' in item) {
                  const source =
                    item.sources.find(
                      candidate => candidate.resource.language === dictionaryResourceLanguage
                    ) ?? item.sources[0]
                  const dictionary = source
                    ? (catalogDictionaries.find(
                        candidate => candidate.resource.work === source.resource.work
                      ) ?? {
                        resource: source.resource,
                        resourceId: source.resourceId,
                        title: source.title,
                        abbreviation: source.abbreviation,
                        authors: [],
                        description: '',
                        edition: '',
                        source: '',
                        attribution: '',
                        onlineAccess: true,
                        offlineDownload: true,
                      })
                    : undefined
                  if (!source || !dictionary) return null
                  return (
                    <DictionnaireItem
                      word={item.label}
                      onSelect={() =>
                        selectWord(source.word, dictionary, source.id, item.correspondenceId)
                      }
                    />
                  )
                }
                return <DictionnaireItem word={item.word} onSelect={() => selectWord(item.word)} />
              }}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
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
                'key' in item
                  ? item.key
                  : item.id
                    ? String(item.id)
                    : `${item.normalizedWord}-${item.word}-${index}`
              }
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
        {!searchValue && <AlphabetList color="secondary" letter={letter} setLetter={setLetter} />}
      </Box>
    </FormSheetScreen>
  )
}

export default DictionaryListScreen
