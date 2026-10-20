import { getSimpleStrongModuleId } from '@bible-strong/resource-domain/strong-lexicon'
import { getPrimaryStrongLexiconAvailability } from '~features/resources/layeredStrongLexiconAccess'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'
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
import { useInfiniteResultsByLetterOrSearch, useSearchValue } from './useUtilities'
import { useTranslation } from 'react-i18next'
import { getLanguage } from '~i18n'
import LexiqueItem, { LEXIQUE_ITEM_HEIGHT } from './LexiqueItem'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import { useResourceLanguage } from '~state/resourcesLanguage'
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

/** A letter title: 16 above, an 18 line, 6 below. */
const SECTION_HEADER_HEIGHT = 40

const getLexiqueItemLayout = sectionListGetItemLayout({
  getItemHeight: () => LEXIQUE_ITEM_HEIGHT,
  getSectionHeaderHeight: () => SECTION_HEADER_HEIGHT,
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
  initialLexicalLanguage?: 'hebrew' | 'greek'
  hasBackButton?: boolean
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
  onStrongSelect?: (book: number, reference: string) => void
}

const LexiqueListScreen = ({
  initialLexicalLanguage,
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
  const [strongResourceLanguage, setStrongResourceLanguage] = useResourceLanguage('STRONG')
  const [lexicalLanguage, setLexicalLanguage] = useState<'all' | 'hebrew' | 'greek'>(
    initialLexicalLanguage ?? 'all'
  )
  const appLanguage = getLanguage()
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()
  const coreAvailabilityQuery = useQuery({
    queryKey: resourceQueryKeys.strongLexiconAvailability(
      getSimpleStrongModuleId(strongResourceLanguage)
    ),
    queryFn: async () => ({
      availability: await getPrimaryStrongLexiconAvailability(
        resources.strongLexicon,
        strongResourceLanguage
      ),
      recoveries: await resources.strongLexicon.getModuleRecoveryActions?.(
        getSimpleStrongModuleId(strongResourceLanguage)
      ),
    }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const { results, isLoading, error, recoveries, retry, fetchNextPage, hasNextPage } =
    useInfiniteResultsByLetterOrSearch(
      {
        queryKey: ['strong-lexicon', lexicalLanguage],
        query: (value, options) =>
          resources.strongLexicon.listEntries({
            language: strongResourceLanguage,
            lexicalLanguage: lexicalLanguage === 'all' ? undefined : lexicalLanguage,
            search: value,
            ...options,
          }),
        value: debouncedSearchValue,
        resourceLanguage: strongResourceLanguage,
      },
      {
        queryKey: ['strong-lexicon', lexicalLanguage],
        query: (value, options) =>
          resources.strongLexicon.listEntries({
            language: strongResourceLanguage,
            lexicalLanguage: lexicalLanguage === 'all' ? undefined : lexicalLanguage,
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
        identity={{
          kind: 'strong-lexicon-module',
          moduleId: getSimpleStrongModuleId(strongResourceLanguage),
        }}
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
        identity={{
          kind: 'strong-lexicon-module',
          moduleId: getSimpleStrongModuleId(strongResourceLanguage),
        }}
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
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <FiltersHeader
          hasBackButton={showBackButton}
          title={t('Lexique')}
          onReset={() => {
            setLexicalLanguage('all')
            setStrongResourceLanguage(appLanguage)
          }}
          filters={[
            {
              key: 'language',
              icon: 'globe',
              label: t('menu.language'),
              value: t(`versionCatalog.language.${strongResourceLanguage}`),
              active: strongResourceLanguage !== appLanguage,
              onPress: () => {},
              options: (['fr', 'en'] as const).map(language => ({
                key: language,
                label: t(`versionCatalog.language.${language}`),
                selected: strongResourceLanguage === language,
                onSelect: () => setStrongResourceLanguage(language),
              })),
            },
            {
              key: 'lexicon',
              icon: 'book-open',
              label: t('Lexique'),
              value: t(
                lexicalLanguage === 'all'
                  ? 'Tout'
                  : lexicalLanguage === 'hebrew'
                    ? 'Hébreu'
                    : 'Grec'
              ),
              active: lexicalLanguage !== 'all',
              onPress: () => {},
              options: (['all', 'hebrew', 'greek'] as const).map(language => ({
                key: language,
                label: t(language === 'all' ? 'Tout' : language === 'hebrew' ? 'Hébreu' : 'Grec'),
                selected: lexicalLanguage === language,
                onSelect: () => setLexicalLanguage(language),
              })),
            },
          ]}
        >
          <Box className="overflow-hidden border-continuous pb-[10px] px-[20px]">
            <SearchInput
              placeholder={t('Recherche par code ou par mot')}
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
            <SectionList<StrongLexiconSearchResult, LexiqueSection>
              renderItem={({ item, index, section }) => (
                <LexiqueItem
                  {...item}
                  onSelect={isNewTabSelection || onStrongSelect ? selectStrong : undefined}
                  hasSeparator={index < section.data.length - 1}
                />
              )}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={(data, index) =>
                getLexiqueItemLayout((data || []) as LexiqueSection[], index)
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
