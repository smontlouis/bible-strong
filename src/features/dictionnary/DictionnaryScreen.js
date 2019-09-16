import React, { useState, useEffect } from 'react'
import { SectionList } from 'react-native'
import styled from '@emotion/native'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import SearchInput from '~common/SearchInput'
import Loading from '~common/Loading'
import loadDictionnaire from '~helpers/loadDictionnaire'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList'

import {
  useSectionIndex,
  useSearchValue,
  useResults,
  useSectionResults,
  useAlphabet
} from '../lexique/useUtilities'

import waitForDatabase from '~common/waitForDictionnaireDB'

import DictionnaireItem from './DictionnaireItem'

const SectionTitle = styled(Box)(({ theme }) => ({
  fontSize: 20,
  marginLeft: 20,
  marginTop: 10,
  height: 30,
  width: 30,
  borderRadius: 15,
  backgroundColor: theme.colors.secondary,
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'visible',
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 2
}))

const DictionnaireScreen = () => {
  const [error, setError] = useState(false)
  const { section, sectionIndex, setSectionIndex, resetSectionIndex } = useSectionIndex()
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue({
    onDebouncedValue: resetSectionIndex
  })
  const results = useResults(loadDictionnaire)
  const sectionResults = useSectionResults(
    results,
    debouncedSearchValue,
    sectionIndex,
    'sanitized_word'
  )
  const alphabet = useAlphabet(results, 'sanitized_word')

  useEffect(() => {
    if (results.error) {
      setError(results.error)
    }
  }, [results])

  if (error) {
    return (
      <Container>
        <Header noBorder title="Désolé..." />
        <Empty
          source={require('~assets/images/empty.json')}
          message={`Impossible de charger le dictionnaire...${
            error === 'CORRUPTED_DATABASE'
              ? '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
              : ''
          }`}
        />
      </Container>
    )
  }

  if (!sectionResults) {
    return <Loading message="Chargement..." />
  }

  return (
    <Container>
      <Header title="Dictionnaire" noBorder />
      <SearchInput
        placeholder="Recherche par mot"
        onChangeText={setSearchValue}
        value={searchValue}
        onDelete={() => setSearchValue('')}
      />
      <Box flex>
        {sectionResults.length ? (
          <SectionList
            ref={section}
            renderItem={({ item: { id, word } }) => <DictionnaireItem key={id} {...{ word }} />}
            removeClippedSubviews
            maxToRenderPerBatch={100}
            getItemLayout={sectionListGetItemLayout({
              getItemHeight: () => 60,
              getSectionHeaderHeight: () => 50,
              getSeparatorHeight: () => 0,
              getSectionFooterHeight: () => 0
            })}
            renderSectionHeader={({ section: { title } }) => (
              <SectionTitle>
                <Text title fontWeight="bold" fontSize={16} color="reverse">
                  {title}
                </Text>
              </SectionTitle>
            )}
            stickySectionHeadersEnabled
            sections={sectionResults}
            keyExtractor={item => item.id}
          />
        ) : (
          <Empty source={require('~assets/images/empty.json')} message="Aucun mot trouvé..." />
        )}
      </Box>
      {!searchValue && (
        <AlphabetList
          color="secondary"
          alphabet={alphabet}
          sectionIndex={sectionIndex}
          onPress={setSectionIndex}
        />
      )}
    </Container>
  )
}

export default waitForDatabase(DictionnaireScreen)
