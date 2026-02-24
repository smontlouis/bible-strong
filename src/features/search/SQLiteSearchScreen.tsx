import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@emotion/react'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'

import booksDesc from '~assets/bible_versions/books-desc'
import DropdownMenu from '~common/DropdownMenu'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import Box, { HStack } from '~common/ui/Box'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  SearchResult,
  SearchOptions,
  SearchSortOrder,
} from '~helpers/biblesDb'
import formatVerseContent from '~helpers/formatVerseContent'
import useDebounce from '~helpers/useDebounce'
import DictionnaryResultsWidget from '~features/dictionnary/DictionnaryResultsWidget'
import LexiqueResultsWidget from '~features/lexique/LexiqueResultsWidget'
import NaveResultsWidget from '~features/nave/NaveResultsWidget'
import BibleReferenceWidget, { parseBibleReference } from '~features/search/BibleReferenceWidget'
import SearchEmptyState from '~features/search/SearchEmptyState'

type Props = {
  searchValue: string
  setSearchValue: (value: string) => void
}

const MIN_SEARCH_LENGTH = 2
const STRONG_CODE_REGEX = /^[HG]\d+$/i

const SQLiteSearchScreen = ({ searchValue, setSearchValue }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const router = useRouter()

  const debouncedSearchValue = useDebounce(searchValue, 300)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasInstalledVersions, setHasInstalledVersions] = useState(true)

  const [section, setSection] = useState('')
  const [book, setBook] = useState(0)
  const [selectedVersion, setSelectedVersion] = useState('')
  const [sortOrder, setSortOrder] = useState<SearchSortOrder>('relevance')
  const [installedVersions, setInstalledVersions] = useState<string[]>([])

  // Load installed versions on mount
  useEffect(() => {
    ;(async () => {
      const versions = await getInstalledVersions()
      setInstalledVersions(versions)
      setHasInstalledVersions(versions.length > 0)
    })()
  }, [])

  const books = [
    {
      Numero: 0,
      Nom: t('Tout'),
      Chapitres: 0,
    },
    ...booksDesc,
  ].map(b => ({
    value: b.Numero,
    label: t(b.Nom),
  }))

  const sectionValues = [
    { value: '', label: t('Tout') },
    { value: 'at', label: t('Ancien Testament') },
    { value: 'nt', label: t('Nouveau Testament') },
  ]

  const versionValues = [
    { value: '', label: t('Toutes les versions') },
    ...installedVersions.map(v => ({ value: v, label: v })),
  ]

  const sortOrderValues = [
    { value: 'relevance', label: t('Pertinence') },
    { value: 'book', label: t('Ordre biblique') },
  ]

  const isStrongCode = Boolean(
    debouncedSearchValue && STRONG_CODE_REGEX.test(debouncedSearchValue.trim())
  )

  // Run search
  useEffect(() => {
    const trimmed = debouncedSearchValue?.trim() ?? ''

    // Not enough characters → clear & show empty state
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setResults(null)
      setTotalCount(0)
      setSearchError(null)
      return
    }

    // Strong's code → skip Bible FTS, only widgets will search
    if (STRONG_CODE_REGEX.test(trimmed)) {
      setResults([])
      setTotalCount(0)
      setSearchError(null)
      return
    }

    let cancelled = false

    const doSearch = async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const sectionMap: Record<string, 'ot' | 'nt'> = { at: 'ot', nt: 'nt' }
        const options: SearchOptions = {
          limit: 200,
          sortOrder,
          ...(selectedVersion && { version: selectedVersion }),
          ...(book && { book }),
          ...(sectionMap[section] && { section: sectionMap[section] }),
        }

        const [searchResults, count] = await Promise.all([
          searchVerses(debouncedSearchValue, options),
          searchVersesCount(debouncedSearchValue, options),
        ])

        if (!cancelled) {
          setResults(searchResults)
          setTotalCount(count)
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[Search] FTS5 error:', e)
          setResults([])
          setTotalCount(0)
          setSearchError(t('search.error.searchFailed'))
        }
      }
      if (!cancelled) {
        setIsSearching(false)
      }
    }

    doSearch()

    return () => {
      cancelled = true
      setIsSearching(false)
    }
  }, [debouncedSearchValue, section, book, selectedVersion, sortOrder])

  const hasReference = Boolean(
    debouncedSearchValue && parseBibleReference(debouncedSearchValue).length > 0
  )

  const hasSearchQuery = Boolean(debouncedSearchValue)
  const showResultsList = hasSearchQuery && (hasInstalledVersions ? Array.isArray(results) : true)

  function renderStatusMessage(): ReactNode {
    if (searchError) {
      return (
        <Box py={10}>
          <Text title fontSize={14} color="quart">
            {searchError}
          </Text>
        </Box>
      )
    }

    if (hasInstalledVersions && !isStrongCode) {
      return (
        <Box py={10}>
          <Text title fontSize={16} color="grey">
            {t('{{nbHits}} occurences trouvées dans la bible', {
              nbHits: totalCount,
            })}
          </Text>
        </Box>
      )
    }

    if (!hasInstalledVersions) {
      return (
        <Box py={10}>
          <Text title fontSize={14} color="grey">
            {t('Téléchargez une Bible pour activer la recherche hors-ligne.')}
          </Text>
        </Box>
      )
    }

    return null
  }

  function renderContent(): ReactNode {
    if (isSearching) {
      return <Loading message={t('Recherche en cours...')} />
    }

    if (hasSearchQuery && hasReference) {
      return (
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          <Box py={10}>
            <BibleReferenceWidget searchValue={debouncedSearchValue} />
          </Box>
        </ScrollView>
      )
    }

    if (showResultsList) {
      return (
        <KeyboardAwareFlatList
          ListHeaderComponent={
            <Box px={20}>
              <Box row wrap py={10}>
                <LexiqueResultsWidget searchValue={debouncedSearchValue} />
                <DictionnaryResultsWidget searchValue={debouncedSearchValue} />
                <NaveResultsWidget searchValue={debouncedSearchValue} />
              </Box>
              {renderStatusMessage()}
            </Box>
          }
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          enableResetScrollToCoords={false}
          style={{
            paddingBottom: 40,
            flex: 1,
            backgroundColor: theme.colors.reverse,
          }}
          removeClippedSubviews
          data={hasInstalledVersions ? (results ?? []) : []}
          keyExtractor={(result: SearchResult) =>
            `${result.version}-${result.book}-${result.chapter}-${result.verse}`
          }
          renderItem={({ item: result }: { item: SearchResult }) => {
            const { title } = formatVerseContent([
              { Livre: result.book, Chapitre: result.chapter, Verset: result.verse },
            ])

            return (
              <SearchResultItem
                reference={title}
                version={result.version}
                highlighted={result.highlighted}
                onPress={() =>
                  router.push({
                    pathname: '/bible-view',
                    params: {
                      isReadOnly: 'true',
                      book: JSON.stringify(booksDesc[result.book - 1]),
                      chapter: String(result.chapter),
                      verse: String(result.verse),
                      focusVerses: JSON.stringify([result.verse]),
                    },
                  })
                }
              />
            )
          }}
        />
      )
    }

    return <SearchEmptyState onExamplePress={setSearchValue} />
  }

  return (
    <Box flex={1}>
      <Box px={20}>
        <SearchInput
          placeholder={t('search.placeholder')}
          onChangeText={setSearchValue}
          value={searchValue}
          onDelete={() => setSearchValue('')}
        />
      </Box>
      {hasInstalledVersions && !hasReference && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 55, paddingHorizontal: 20 }}
        >
          <DropdownMenu
            title={t('Section')}
            currentValue={section}
            setValue={setSection}
            choices={sectionValues}
          />
          <DropdownMenu
            title={t('Livre')}
            // @ts-ignore - DropdownMenu expects string but book filter uses number values
            currentValue={book}
            // @ts-ignore
            setValue={setBook}
            // @ts-ignore
            choices={books}
          />
          {installedVersions.length > 1 && (
            <DropdownMenu
              title={t('Version')}
              currentValue={selectedVersion}
              setValue={setSelectedVersion}
              choices={versionValues}
            />
          )}
          <DropdownMenu
            title={t('Ordre')}
            currentValue={sortOrder}
            setValue={(v: string) => setSortOrder(v as SearchSortOrder)}
            choices={sortOrderValues}
          />
        </ScrollView>
      )}
      {renderContent()}
    </Box>
  )
}

type SearchResultItemProps = {
  reference: string
  version: string
  highlighted: string
  onPress: () => void
}

const SearchResultItem = ({ reference, version, highlighted, onPress }: SearchResultItemProps) => {
  const parts = highlighted.split(/(\{\{.*?\}\})/g)

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Box px={20} pt={15} pb={20} borderBottomWidth={1} borderColor="border">
        <HStack alignItems="center" gap={4} mb={4}>
          <Text title fontSize={14}>
            {reference}
          </Text>
          <Chip>{version}</Chip>
        </HStack>
        <Paragraph small>
          {parts.map((part, i) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
              return (
                <Paragraph small bold color="primary" key={i}>
                  {part.slice(2, -2)}
                </Paragraph>
              )
            }
            return part
          })}
        </Paragraph>
      </Box>
    </TouchableOpacity>
  )
}

export default SQLiteSearchScreen
