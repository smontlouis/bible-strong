import React, { useState, useEffect } from 'react'
import styled from '@emotion/native'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import Container from '~common/ui/Container'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import SearchInput from '~common/SearchInput'
import Loading from '~common/Loading'
import loadLexique from '~helpers/loadLexique'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList'

import {
  useSectionIndex,
  useSearchValue,
  useResults,
  useSectionResults,
  useAlphabet
} from './useUtilities'

import waitForDatabase from '~common/waitForStrongDB'

import LexiqueItem from './LexiqueItem'

const SectionTitle = styled(Box)(({ theme }) => ({
  fontSize: 20,
  marginLeft: 20,
  marginTop: 10,
  height: 30,
  width: 30,
  borderRadius: 15,
  backgroundColor: theme.colors.primary,
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'visible'
}))

const LexiqueScreen = () => {
  const [error, setError] = useState(false)
  const { section, sectionIndex, setSectionIndex, resetSectionIndex } = useSectionIndex()
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue({
    onDebouncedValue: resetSectionIndex
  })
  const results = useResults(loadLexique)
  const sectionResults = useSectionResults(results, debouncedSearchValue, sectionIndex)
  const alphabet = useAlphabet(results)

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
        {!sectionResults ? (
          <Loading message="Chargement..." />
        ) : sectionResults.length ? (
          <SectionList
            ref={section}
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
              <SectionTitle>
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
      {!searchValue && (
        <AlphabetList alphabet={alphabet} sectionIndex={sectionIndex} onPress={setSectionIndex} />
      )}
    </Container>
  )
}

export default waitForDatabase(LexiqueScreen)
