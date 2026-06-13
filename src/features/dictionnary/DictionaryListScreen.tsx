import React, { useEffect, useState } from 'react'
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
import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { DatabaseError } from '~helpers/catchDatabaseError'
import { getFirstLetterFrom } from '~helpers/alphabet'
import type {
  DictionnaireLetterRow,
  DictionnaireSearchRow,
} from '~features/resources/dictionaryAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { DictionaryTab } from '../../state/tabs'
import { useResultsByLetterOrSearch, useSearchValue } from '../lexique/useUtilities'
import DictionnaireItem from './DictionnaireItem'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'

type DictionaryRow = DictionnaireLetterRow | DictionnaireSearchRow

interface DictionarySection {
  title: string
  data: DictionaryRow[]
}

const isDatabaseError = (value: unknown): value is DatabaseError =>
  typeof value === 'object' && value !== null && 'error' in value

const getDictionaryItemLayout = sectionListGetItemLayout({
  getItemHeight: () => 60,
  getSectionHeaderHeight: () => 50,
  getSeparatorHeight: () => 0,
  getSectionFooterHeight: () => 0,
})

const useSectionResults = (results: DictionaryRow[]) => {
  const [sectionResults, setSectionResults] = useState<DictionarySection[]>([])

  useEffect(() => {
    if (!results.length) {
      setSectionResults([])
      return
    }
    const sectionResults = results.reduce<DictionarySection[]>((list, dbItem) => {
      const listItem = list.find(
        item => item.title && item.title === getFirstLetterFrom(dbItem.sanitized_word)
      )
      if (!listItem) {
        list.push({
          title: getFirstLetterFrom(dbItem.sanitized_word),
          data: [dbItem],
        })
      } else {
        listItem.data.push(dbItem)
      }

      return list
    }, [])
    setSectionResults(sectionResults)
  }, [results])

  return sectionResults
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
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const [error, setError] = useState<DatabaseError['error'] | null>(null)
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()

  const { results, isLoading } = useResultsByLetterOrSearch(
    { query: resources.dictionary.search, value: debouncedSearchValue },
    { query: resources.dictionary.listByLetter, value: letter }
  )

  const dictionaryResults = Array.isArray(results) ? results : []
  const sectionResults = useSectionResults(dictionaryResults)

  useEffect(() => {
    if (isDatabaseError(results)) {
      setError(results.error)
    }
  }, [results])

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
              error === 'CORRUPTED_DATABASE'
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
                item.rowid ? String(item.rowid) : `${item.sanitized_word}-${item.word}-${index}`
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

export default waitForDictionnaireDB({
  hasBackButton: true,
  hasHeader: true,
})(DictionaryListScreen)
