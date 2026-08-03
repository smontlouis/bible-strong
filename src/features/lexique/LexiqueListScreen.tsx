import React, { useState } from 'react'
import { MenuView } from '~common/ui/MenuView'
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

import { useResultsByLetterOrSearch, useSearchValue } from './useUtilities'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import waitForStrongDB from '~common/waitForStrongDB'
import { StrongTab } from '../../state/tabs'
import LexiqueItem from './LexiqueItem'
import { FeatherIcon } from '~common/ui/Icon'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

interface LexiqueSection {
  title: string
  data: StrongLexiconSearchResult[]
}

const getLexiqueItemLayout = sectionListGetItemLayout({
  getItemHeight: () => 80,
  getSectionHeaderHeight: () => 50,
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
  const resources = useResourceAccess()
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const {
    language: strongResourceLanguage,
    menuTitle: strongLanguageMenuTitle,
    toggleLanguage: toggleStrongLanguage,
  } = useStrongLexiconLanguage()
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()

  const { results, isLoading, error } = useResultsByLetterOrSearch(
    {
      queryKey: ['strong-lexicon'],
      query: value => resources.strongLexicon.search(value, strongResourceLanguage, 200),
      value: debouncedSearchValue,
      resourceLanguage: strongResourceLanguage,
    },
    {
      queryKey: ['strong-lexicon'],
      query: value =>
        resources.strongLexicon.browseByGlossPrefix(value, strongResourceLanguage, 500),
      value: letter,
      resourceLanguage: strongResourceLanguage,
    }
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
                  title: strongLanguageMenuTitle,
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
            <SectionList<StrongLexiconSearchResult, LexiqueSection>
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
              keyExtractor={item => `${item.id}:${item.stepCode}`}
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
