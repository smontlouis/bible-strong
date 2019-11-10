import React, { useState, useEffect } from 'react'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import Container from '~common/ui/Container'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import SearchInput from '~common/SearchInput'
import Loading from '~common/Loading'
import loadLexiqueByLetter from '~helpers/loadLexiqueByLetter'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import { getFirstLetterFrom } from '~helpers/alphabet'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList2'
import SectionTitle from '~common/SectionTitle'

import { useSearchValue, useResultsByLetterOrSearch } from './useUtilities'

import waitForDatabase from '~common/waitForStrongDB'
import LexiqueItem from './LexiqueItem'

const useSectionResults = results => {
  const [sectionResults, setSectionResults] = useState(null)

  useEffect(() => {
    if (!results.length) {
      setSectionResults([])
      return
    }
    const sectionResults = results.reduce((list, dbItem) => {
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

const LexiqueScreen = () => {
  const [error, setError] = useState(false)
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()

  const { results, isLoading } = useResultsByLetterOrSearch(
    { query: loadLexiqueBySearch, value: debouncedSearchValue },
    { query: loadLexiqueByLetter, value: letter }
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
        <Header hasBackButton title="Désolé..." />
        <Empty
          source={require('~assets/images/empty.json')}
          message={`Impossible de charger la strong pour ce verset...${
            error === 'CORRUPTED_DATABASE'
              ? '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
              : ''
          }`}
        />
      </Container>
    )
  }

  return (
    <Container>
      <Header hasBackButton title="Lexique" />
      <SearchInput
        disabled={!sectionResults}
        placeholder="Recherche par code ou par mot"
        onChangeText={setSearchValue}
        value={searchValue}
        onDelete={() => setSearchValue('')}
      />
      <Box flex paddingTop={20}>
        {isLoading ? (
          <Loading message="Chargement..." />
        ) : sectionResults.length ? (
          <SectionList
            renderItem={({ item: { Mot, Grec, Hebreu, Code, lexiqueType }, index }) => (
              <LexiqueItem key={index} {...{ Mot, Grec, Hebreu, Code, lexiqueType }} />
            )}
            removeClippedSubviews
            maxToRenderPerBatch={100}
            getItemLayout={sectionListGetItemLayout({
              getItemHeight: () => 80,
              getSectionHeaderHeight: () => 50,
              getSeparatorHeight: () => 0,
              getSectionFooterHeight: () => 0
            })}
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
          <Empty source={require('~assets/images/empty.json')} message="Aucune strong trouvée..." />
        )}
      </Box>
      {!searchValue && <AlphabetList letter={letter} setLetter={setLetter} />}
    </Container>
  )
}

export default waitForDatabase(LexiqueScreen)
