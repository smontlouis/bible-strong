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

import { useWaitForDatabase } from '~common/waitForStrongDB'

import LexiqueItem from './LexiqueItem'

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

const LexiqueScreen = () => {
  const isLoading = useWaitForDatabase()
  const { section, sectionIndex, setSectionIndex, resetSectionIndex } = useSectionIndex()
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue({
    onDebouncedValue: resetSectionIndex
  })
  const results = useResults(isLoading, loadLexique)
  const sectionResults = useSectionResults(results, debouncedSearchValue, sectionIndex)
  const alphabet = useAlphabet(results)

  if (isLoading) {
    return <Loading message="Téléchargement du dictionnaire..." />
  }

  if (!sectionResults) {
    return <Loading message="Chargement..." />
  }

  return (
    <Container>
      <Header title="Lexique" />
      <SearchInput
        placeholder="Recherche par code ou par mot"
        onChangeText={setSearchValue}
        value={searchValue}
      />
      <Box flex>
        {sectionResults.length ? (
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
                <Text title fontWeight="bold" fontSize={18} color="default">
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

export default LexiqueScreen
