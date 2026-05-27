import React, { useEffect, useState } from 'react'
import { MenuView } from '@expo/ui/community/menu'
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
import { DatabaseError } from '~helpers/catchDatabaseError'
import loadLexiqueByLetter, { type LexiqueRow } from '~helpers/loadLexiqueByLetter'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'

import { useResultsByLetterOrSearch, useSearchValue } from './useUtilities'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import waitForStrongDB from '~common/waitForStrongDB'
import { StrongTab } from '../../state/tabs'
import LexiqueItem from './LexiqueItem'
import { FeatherIcon } from '~common/ui/Icon'
import { toast } from '~helpers/toast'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useResourceLanguage } from 'src/state/resourcesLanguage'

interface LexiqueSection {
  title: string
  data: LexiqueRow[]
}

const isDatabaseError = (value: unknown): value is DatabaseError =>
  typeof value === 'object' && value !== null && 'error' in value

const getLexiqueItemLayout = sectionListGetItemLayout({
  getItemHeight: () => 80,
  getSectionHeaderHeight: () => 50,
  getSeparatorHeight: () => 0,
  getSectionFooterHeight: () => 0,
})

const useSectionResults = (results: LexiqueRow[]) => {
  const [sectionResults, setSectionResults] = useState<LexiqueSection[]>([])

  useEffect(() => {
    if (!results.length) {
      setSectionResults([])
      return
    }
    const sectionResults = results.reduce<LexiqueSection[]>((list, dbItem) => {
      const listItem = list.find(
        item => item.title && item.title === getFirstLetterFrom(dbItem.Mot)
      )
      if (!listItem) {
        list.push({ title: getFirstLetterFrom(dbItem.Mot), data: [dbItem] })
      } else {
        listItem.data.push(dbItem)
      }

      return list
    }, [])
    setSectionResults(sectionResults)
  }, [results])

  return sectionResults
}

interface LexiqueListScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
  hasBackButton?: boolean
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
  onStrongSelect?: (book: number, reference: string) => void
}

const LexiqueListScreen = ({
  strongAtom,
  hasBackButton,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
  onStrongSelect,
}: LexiqueListScreenProps) => {
  const { t } = useTranslation()
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const [strongResourceLanguage, setStrongResourceLanguage] = useResourceLanguage('STRONG')
  const [error, setError] = useState<DatabaseError['error'] | null>(null)
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()

  const { results, isLoading } = useResultsByLetterOrSearch(
    { query: loadLexiqueBySearch, value: debouncedSearchValue },
    { query: loadLexiqueByLetter, value: letter }
  )

  const lexiqueResults = Array.isArray(results) ? results : []
  const sectionResults = useSectionResults(lexiqueResults)

  useEffect(() => {
    if (isDatabaseError(results)) {
      setError(results.error)
    }
  }, [results])

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

  const toggleStrongLanguage = () => {
    const nextLanguage = strongResourceLanguage === 'fr' ? 'en' : 'fr'
    setStrongResourceLanguage(nextLanguage)
    toast(t('menu.languageChanged', { language: nextLanguage === 'fr' ? 'Français' : 'English' }))
  }

  if (error) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box flex bg="reverse">
          <Header hasBackButton={showBackButton} title={t('Désolé...')} />
          <Empty
            icon={require('~assets/images/empty-state-icons/inbox.svg')}
            message={`${t('Impossible de charger la strong pour ce verset...')}
            ${
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
        <Header
          hasBackButton={showBackButton}
          title={t('Lexique')}
          rightComponent={
            <MenuView
              actions={[
                {
                  id: 'language',
                  title: `${t('menu.language')}: ${
                    strongResourceLanguage === 'fr' ? 'Français' : 'English'
                  }`,
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
            <SectionList<LexiqueRow, LexiqueSection>
              renderItem={({ item, index }) => (
                <LexiqueItem
                  key={index}
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
              keyExtractor={item => item.Mot + item.Code}
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

export default waitForStrongDB({
  hasBackButton: true,
  hasHeader: true,
})(LexiqueListScreen)
