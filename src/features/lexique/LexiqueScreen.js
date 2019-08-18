import React, { useEffect, useState, useRef } from 'react'
import { SectionList } from 'react-native'
import styled from '@emotion/native'
import debounce from 'debounce'
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
import useDebounce from '~helpers/useDebounce'
import { alphabet, getFirstLetterFrom } from '~helpers/alphabet'
import { useWaitForDatabase } from '~common/waitForStrongDB'

import LexiqueItem from './LexiqueItem'

const SectionTitle = styled(Box)(({ theme }) => ({
  fontSize: 20,
  paddingLeft: 20,
  paddingRight: 20,
  height: 50,
  backgroundColor: theme.colors.border,
  // borderBottomColor: theme.colors.border,
  // borderBottomWidth: 1,
  justifyContent: 'center'
}))

const LexiqueScreen = () => {
  const isLoading = useWaitForDatabase()
  const [results, setResults] = useState([])
  const [sectionResults, setSectionResults] = useState(null)
  const [searchValue, setSearchValue] = useState('')
  const [sectionIndex, setSectionIndex] = useState(0)

  const section = useRef()
  const debouncedSearchValue = useDebounce(searchValue, 100)

  useEffect(() => {
    if (!isLoading) {
      loadLexique().then(results => setResults(results))
    }
  }, [isLoading])

  useEffect(() => {
    if (!debouncedSearchValue) {
      setSectionIndex(0)
    }
  }, [debouncedSearchValue])

  useEffect(() => {
    if (!results.length) return

    let filteredResults = debouncedSearchValue
      ? (filteredResults = results.filter(
          c =>
            c.Code == debouncedSearchValue ||
            c.Mot.toLowerCase().includes(debouncedSearchValue.toLowerCase())
        ))
      : results

    const sectionResults = filteredResults.reduce((list, name) => {
      const listItem = list.find(item => item.title && item.title === getFirstLetterFrom(name.Mot))
      if (!listItem) {
        list.push({ title: getFirstLetterFrom(name.Mot), data: [name] })
      } else {
        listItem.data.push(name)
      }

      return list
    }, [])
    setSectionResults(debouncedSearchValue ? sectionResults : [sectionResults[sectionIndex]])
  }, [results, debouncedSearchValue, sectionIndex])

  if (isLoading) {
    return <Loading message="Téléchargement du dictionnaire..." />
  }

  // console.log(sectionResults)

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
        {!searchValue && <AlphabetList sectionIndex={sectionIndex} onPress={setSectionIndex} />}
      </Box>
    </Container>
  )
}

export default LexiqueScreen
