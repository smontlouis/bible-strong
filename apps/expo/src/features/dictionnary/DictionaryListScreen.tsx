import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { getLanguage } from '~i18n'
import AlphabetList from '~common/AlphabetList'
import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { ListSectionTitle } from '~common/ui/ListSection'
import SectionList from '~common/ui/SectionList'
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
import DictionnaireItem, { DICTIONNAIRE_ITEM_HEIGHT } from './DictionnaireItem'
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
type DictionaryRow = DictionarySummary | DictionaryDirectoryItem

interface DictionarySection {
  title: string
  data: DictionaryRow[]
}

/** A letter title: 16 above, an 18 line, 6 below. */
const SECTION_HEADER_HEIGHT = 40

const getDictionaryItemLayout = sectionListGetItemLayout({
  getItemHeight: () => DICTIONNAIRE_ITEM_HEIGHT,
  getSectionHeaderHeight: () => SECTION_HEADER_HEIGHT,
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
  const appLanguage = getLanguage()
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
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <FiltersHeader
          hasBackButton={showBackButton}
          title={t('Dictionnaire')}
          onReset={() => {
            if (dictionaryResourceLanguage !== appLanguage) selectLanguage(appLanguage)
            else selectDirectory()
          }}
          filters={[
            {
              key: 'language',
              icon: 'globe',
              label: t('menu.language'),
              value: t(`versionCatalog.language.${dictionaryResourceLanguage}`),
              active: dictionaryResourceLanguage !== appLanguage,
              onPress: () => {},
              options: (['fr', 'en'] as const).map(language => ({
                key: language,
                label: t(`versionCatalog.language.${language}`),
                selected: dictionaryResourceLanguage === language,
                onSelect: () => selectLanguage(language),
              })),
            },
            ...(catalogDictionaries.length
              ? [
                  {
                    key: 'dictionary-source',
                    icon: 'book' as const,
                    label: t('Dictionnaire'),
                    value: directoryRequested ? t('Tous') : selectedDictionary.abbreviation,
                    active: !directoryRequested,
                    onPress: () => {},
                    options: [
                      {
                        key: 'directory',
                        label: t('Tous les dictionnaires'),
                        selected: directoryRequested,
                        onSelect: selectDirectory,
                      },
                      ...catalogDictionaries.map(dictionary => ({
                        key: dictionary.resource.work,
                        label: dictionary.abbreviation,
                        selected: !directoryRequested && dictionary.resource.work === selectedWork,
                        onSelect: () => selectDictionary(dictionary),
                      })),
                    ],
                  },
                ]
              : []),
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
            <SectionList<DictionaryRow, DictionarySection>
              renderItem={({ item, index, section }) => {
                const hasSeparator = index < section.data.length - 1
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
                      hasSeparator={hasSeparator}
                    />
                  )
                }
                return (
                  <DictionnaireItem
                    word={item.word}
                    onSelect={() => selectWord(item.word, selectedDictionary, item.id)}
                    hasSeparator={hasSeparator}
                  />
                )
              }}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={(data, index) =>
                getDictionaryItemLayout((data || []) as DictionarySection[], index)
              }
              renderSectionHeader={({ section: { title } }) => (
                <Box className="bg-reverse" style={{ height: SECTION_HEADER_HEIGHT }}>
                  <ListSectionTitle className="ml-[20px] mt-[16px] mb-[6px] leading-[18px]">
                    {title}
                  </ListSectionTitle>
                </Box>
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
