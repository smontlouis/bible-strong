import React from 'react'
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
  paddingLeft: 20,
  paddingRight: 20,
  height: 50,
  backgroundColor: theme.colors.border,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  justifyContent: 'center'
}))

const DictionnaireScreen = () => {
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

  if (!sectionResults) {
    return <Loading message="Chargement..." />
  }

  return (
    <Container>
      <Header title="Dictionnaire" />
      <SearchInput
        placeholder="Recherche par mot"
        onChangeText={setSearchValue}
        value={searchValue}
      />
      <Box flex>
        {sectionResults.length ? (
          <SectionList
            ref={section}
            renderItem={({ item: { id, word } }) => <DictionnaireItem key={id} {...{ word }} />}
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
                <Text title fontWeight="bold" fontSize={18} color="default">
                  {title}
                </Text>
              </SectionTitle>
            )}
            stickySectionHeadersEnabled
            sections={sectionResults}
            keyExtractor={item => item.id}
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

export default waitForDatabase(DictionnaireScreen)
