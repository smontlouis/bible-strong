// TODO : is this file still in use ? If not, remove it
import React, { useEffect, useState } from 'react'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import { StackNavigationProp } from '@react-navigation/stack'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import AlphabetList from '~common/AlphabetList'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import SectionTitle from '~common/SectionTitle'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { getFirstLetterFrom } from '~helpers/alphabet'
import loadDictionnaireByLetter from '~helpers/loadDictionnaireByLetter'
import loadDictionnaireBySearch from '~helpers/loadDictionnaireBySearch'
import { MainStackProps } from '~navigation/type'
import { DictionariesTab } from '../../state/tabs'
import {
  useResultsByLetterOrSearch,
  useSearchValue,
} from '../lexique/useUtilities'
import DictionnaireItem from './DictionnaireItem'

const useSectionResults = (results) => {
  const [sectionResults, setSectionResults] = useState(null)

  useEffect(() => {
    if (!results.length) {
      setSectionResults([])
      return
    }
    const sectionResults = results.reduce((list, dbItem) => {
      const listItem = list.find(
        (item) =>
          item.title && item.title === getFirstLetterFrom(dbItem.sanitized_word)
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

interface DictionariesTabScreenProps {
  navigation: StackNavigationProp<MainStackProps>
  dictionariesAtom: PrimitiveAtom<DictionariesTab>
  hasBackButton?: boolean
}

const DictionnaireScreen = ({
  hasBackButton,
  navigation,
}: DictionariesTabScreenProps) => {
  const { t } = useTranslation()
  const [error, setError] = useState(false)
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()

  const { results, isLoading } = useResultsByLetterOrSearch(
    { query: loadDictionnaireBySearch, value: debouncedSearchValue },
    { query: loadDictionnaireByLetter, value: letter }
  )

  const sectionResults = useSectionResults(results)

  useEffect(() => {
    if (results.error) {
      setError(results.error)
    }
  }, [results])

  if (error) {
    return (
      <Container>
        <Header hasBackButton={hasBackButton} title={t('Désolé...')} />
        <Empty
          source={require('~assets/images/empty.json')}
          message={`${t('Impossible de charger le dictionnaire...')}${
            error === 'CORRUPTED_DATABASE'
              ? t(
                  '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
                )
              : ''
          }`}
        />
      </Container>
    )
  }

  return (
    <Container>
      <Header
        hasBackButton={hasBackButton}
        fontSize={18}
        title={t('Dictionnaire Westphal')}
      />
      <Box px={20}>
        <SearchInput
          placeholder={t('Recherche par mot')}
          onChangeText={setSearchValue}
          value={searchValue}
          onDelete={() => setSearchValue('')}
        />
      </Box>
      <Box flex paddingTop={20}>
        {isLoading ? (
          <Loading message={t('Chargement...')} />
        ) : sectionResults.length ? (
          <SectionList
            renderItem={({ item: { id, word } }) => (
              <DictionnaireItem
                key={id}
                navigation={navigation}
                {...{ word }}
              />
            )}
            removeClippedSubviews
            maxToRenderPerBatch={100}
            getItemLayout={sectionListGetItemLayout({
              getItemHeight: () => 60,
              getSectionHeaderHeight: () => 50,
              getSeparatorHeight: () => 0,
              getSectionFooterHeight: () => 0,
            })}
            renderSectionHeader={({ section: { title } }) => (
              <SectionTitle color="secondary">
                <Text title fontWeight="bold" fontSize={16} color="reverse">
                  {title}
                </Text>
              </SectionTitle>
            )}
            stickySectionHeadersEnabled
            sections={sectionResults}
            keyExtractor={(item) => item.id}
          />
        ) : (
          <Empty
            source={require('~assets/images/empty.json')}
            message={t('Aucun mot trouvé...')}
          />
        )}
      </Box>
      {!searchValue && (
        <AlphabetList color="secondary" letter={letter} setLetter={setLetter} />
      )}
    </Container>
  )
}

export default waitForDictionnaireDB({
  hasBackButton: true,
  hasHeader: true,
})(DictionnaireScreen)
