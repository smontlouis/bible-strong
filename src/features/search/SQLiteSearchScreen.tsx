import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@emotion/react'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'

import booksDesc from '~assets/bible_versions/books-desc'
import DropdownMenu from '~common/DropdownMenu'
import Empty from '~common/Empty'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  SearchResult,
  SearchOptions,
} from '~helpers/biblesDb'
import useDebounce from '~helpers/useDebounce'

type Props = {
  searchValue: string
  setSearchValue: (value: string) => void
}

const SQLiteSearchScreen = ({ searchValue, setSearchValue }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const router = useRouter()

  const debouncedSearchValue = useDebounce(searchValue, 300)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [hasInstalledVersions, setHasInstalledVersions] = useState(true)

  const [section, setSection] = useState('')
  const [book, setBook] = useState(0)
  const [selectedVersion, setSelectedVersion] = useState('')
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

  // Run search
  useEffect(() => {
    if (!debouncedSearchValue) {
      setResults(null)
      setTotalCount(0)
      return
    }

    const doSearch = async () => {
      setIsSearching(true)
      try {
        const options: SearchOptions = {
          limit: 200,
        }

        if (selectedVersion) {
          options.version = selectedVersion
        }

        if (book) {
          options.book = book
        }

        if (section === 'at') {
          options.section = 'ot'
        } else if (section === 'nt') {
          options.section = 'nt'
        }

        const [searchResults, count] = await Promise.all([
          searchVerses(debouncedSearchValue, options),
          searchVersesCount(debouncedSearchValue, options),
        ])

        setResults(searchResults)
        setTotalCount(count)
      } catch (e) {
        console.error('[Search] FTS5 error:', e)
        setResults([])
        setTotalCount(0)
      }
      setIsSearching(false)
    }

    doSearch()
  }, [debouncedSearchValue, section, book, selectedVersion])

  if (!hasInstalledVersions) {
    return (
      <Empty
        icon={require('~assets/images/empty-state-icons/search.svg')}
        message={t('Téléchargez une Bible pour activer la recherche hors-ligne.')}
      />
    )
  }

  return (
    <Box px={20} flex={1}>
      <SearchInput
        placeholder={t('search.placeholder')}
        onChangeText={setSearchValue}
        value={searchValue}
        onDelete={() => setSearchValue('')}
      />
      <ScrollView
        horizontal
        style={{
          maxHeight: 55,
          paddingHorizontal: 10,
        }}
        contentContainerStyle={{
          flexDirection: 'row',
        }}
      >
        <DropdownMenu
          title={t('Section')}
          currentValue={section}
          setValue={setSection}
          choices={sectionValues}
        />
        <DropdownMenu
          title={t('Livre')}
          // @ts-ignore
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
      </ScrollView>
      {isSearching ? (
        <Loading message={t('Recherche en cours...')} />
      ) : debouncedSearchValue && Array.isArray(results) ? (
        <KeyboardAwareFlatList
          ListHeaderComponent={
            <Box paddingVertical={10}>
              <Text title fontSize={16} color="grey">
                {t('{{nbHits}} occurences trouvées dans la bible', {
                  nbHits: totalCount,
                })}
              </Text>
            </Box>
          }
          enableOnAndroid={true}
          keyboardShouldPersistTaps="handled"
          enableResetScrollToCoords={false}
          style={{
            padding: 20,
            paddingTop: 0,
            paddingBottom: 40,
            flex: 1,
            backgroundColor: theme.colors.reverse,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
          }}
          removeClippedSubviews
          data={results}
          keyExtractor={(result: SearchResult) =>
            `${result.book}-${result.chapter}-${result.verse}`
          }
          renderItem={({ item: result }: { item: SearchResult }) => {
            const { title } = formatVerseContent([
              { Livre: result.book, Chapitre: result.chapter, Verset: result.verse },
            ])

            return (
              <SearchResultItem
                reference={title}
                highlighted={result.highlighted}
                text={result.text}
                onPress={() =>
                  router.push({
                    pathname: '/bible-view',
                    params: {
                      isReadOnly: 'true',
                      book: JSON.stringify(booksDesc[result.book - 1]),
                      chapter: String(result.chapter),
                      verse: String(result.verse),
                    },
                  })
                }
              />
            )
          }}
        />
      ) : (
        <Empty
          icon={require('~assets/images/empty-state-icons/search.svg')}
          message={t('Fais une recherche dans la Bible !')}
        />
      )}
    </Box>
  )
}

const SearchResultItem = ({
  reference,
  highlighted,
  text,
  onPress,
}: {
  reference: string
  highlighted: string
  text: string
  onPress: () => void
}) => {
  // Parse {{ and }} markers from FTS5 highlight() into bold Text elements
  const parts = highlighted.split(/(\{\{.*?\}\})/g)

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Box paddingTop={15} paddingBottom={20} borderBottomWidth={1} borderColor="border">
        <Text title fontSize={16} marginBottom={5}>
          {reference}
        </Text>
        <Paragraph small>
          {parts.map((part, i) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
              return (
                <Text bold color="primary" key={i}>
                  {part.slice(2, -2)}
                </Text>
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
