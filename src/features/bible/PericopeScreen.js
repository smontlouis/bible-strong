import React, { useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import books from '~assets/bible_versions/books-desc'
import Container from '~common/ui/Container'
import PericopeHeader from './PericopeHeader'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import Empty from '~common/Empty'
import getBiblePericope from '~helpers/getBiblePericope'

const H1 = styled(Text)(() => ({
  fontSize: 24,
  marginLeft: 20,
  marginBottom: 20
}))

const H2 = styled(Text)(() => ({
  fontSize: 20,
  marginLeft: 20,
  marginBottom: 20
}))

const H3 = styled(Text)(() => ({
  fontSize: 18,
  marginLeft: 20,
  marginBottom: 20
}))

const H4 = styled(Text)(() => ({
  fontSize: 16,
  marginLeft: 20,
  marginBottom: 20
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

function clearEmpties(o) {
  for (const k in o) {
    if (!o[k] || typeof o[k] !== 'object') {
      continue // If null or not an object, skip to the next iteration
    }

    // The property is an object
    clearEmpties(o[k]) // <-- Make a recursive call on the nested object
    if (Object.keys(o[k]).length === 0) {
      delete o[k] // The object had no properties, so delete that property
    }
  }
  return o
}

const PericopeScreen = ({ navigation }) => {
  const { initialVersion, initialBook } = useSelector(state => ({
    initialVersion: state.bible.selectedVersion,
    initialBook: state.bible.selectedBook
  }))
  const [version, setVersion] = useState(initialVersion)
  const [book, setBook] = useState(initialBook)

  const pericope = getBiblePericope(version)
  const pericopeBook = clearEmpties(pericope[book.Numero])

  return (
    <Container>
      <PericopeHeader
        version={version}
        setVersion={setVersion}
        hasBackButton
        title={`Péricopes ${version}`}
      />
      <ScrollView>
        <Box padding={20}>
          <Text title scaleLineHeight={-2} fontSize={50} marginBottom={40}>
            {book.Nom}
          </Text>
          {!Object.keys(pericopeBook).length ? (
            <Empty
              source={require('~assets/images/empty.json')}
              message="Aucun péricope pour ce Livre, essayez avec une autre version."
            />
          ) : (
            Object.entries(pericopeBook).map(([chapterKey, chapterObject]) => {
              return (
                <React.Fragment key={chapterKey}>
                  {!!Object.keys(chapterObject).length && (
                    <Text titleItalic color="tertiary" fontSize={12} marginBottom={10}>
                      CHAPITRE{' '}
                      <Text titleItalic color="tertiary" fontSize={20}>
                        {chapterKey}
                      </Text>
                    </Text>
                  )}
                  {Object.entries(chapterObject).map(([verseKey, verseObject]) => {
                    const { h1, h2, h3, h4 } = verseObject
                    return (
                      <TouchableOpacity
                        key={verseKey}
                        onPress={() =>
                          navigation.navigate({
                            routeName: 'BibleView',
                            params: {
                              isReadOnly: true,
                              book,
                              chapter: chapterKey,
                              version,
                              verse: 1
                            }
                          })
                        }>
                        {h1 && (
                          <H1 title scaleLineHeight={-2}>
                            {h1}
                          </H1>
                        )}
                        {h2 && (
                          <H2 title scaleLineHeight={-2}>
                            {h2}
                          </H2>
                        )}
                        {h3 && (
                          <H3 title scaleLineHeight={-2}>
                            {h3}
                          </H3>
                        )}
                        {h4 && (
                          <H4 title scaleLineHeight={-2}>
                            {h4}
                          </H4>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </React.Fragment>
              )
            })
          )}
        </Box>
      </ScrollView>
      <Box row paddingHorizontal={20} paddingVertical={10} justifyContent="space-between">
        {book.Numero != 1 && (
          <Link onPress={() => setBook(books[book.Numero - 2])}>
            <StyledIcon name="arrow-left" size={30} />
          </Link>
        )}
        {book.Numero != 66 && (
          <Link onPress={() => setBook(books[book.Numero])} style={{ marginLeft: 'auto' }}>
            <StyledIcon name="arrow-right" size={30} />
          </Link>
        )}
      </Box>
    </Container>
  )
}

export default PericopeScreen
