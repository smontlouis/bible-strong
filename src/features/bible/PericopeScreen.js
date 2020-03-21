import React, { useState, useEffect } from 'react'
import { TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import books from '~assets/bible_versions/books-desc'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import PericopeHeader from './PericopeHeader'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import Empty from '~common/Empty'
import getBiblePericope from '~helpers/getBiblePericope'
import SnackBar from '~common/SnackBar'

const H1 = styled(Paragraph)(() => ({
  fontSize: 24,
  marginLeft: 20,
  marginBottom: 20
}))

const H2 = styled(Paragraph)(() => ({
  fontSize: 20,
  marginLeft: 20,
  marginBottom: 20
}))

const H3 = styled(Paragraph)(() => ({
  fontSize: 18,
  marginLeft: 20,
  marginBottom: 20
}))

const H4 = styled(Paragraph)(() => ({
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
  const [versionNeedsDownload, setVersionNeedsDownload] = useState(false)

  const pericope = getBiblePericope(version)
  const pericopeBook = clearEmpties(pericope[book.Numero])

  useEffect(() => {
    if (version) {
      const check = async () => {
        const versionNeedsDownload = await getIfVersionNeedsDownload(version)
        setVersionNeedsDownload(versionNeedsDownload)
      }
      check()
    }
  }, [version])

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
          <Paragraph style={{ fontSize: 30 }} marginBottom={40}>
            {book.Nom}
          </Paragraph>
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
                    <Text
                      titleItalic
                      color="tertiary"
                      fontSize={12}
                      marginBottom={10}
                    >
                      CHAPITRE {chapterKey}
                    </Text>
                  )}
                  {Object.entries(chapterObject).map(
                    ([verseKey, verseObject]) => {
                      const { h1, h2, h3, h4 } = verseObject
                      return (
                        <TouchableOpacity
                          key={verseKey}
                          onPress={() =>
                            versionNeedsDownload
                              ? SnackBar.show(
                                  'Vous devez télécharger cette version de la Bible.'
                                )
                              : navigation.navigate({
                                  routeName: 'BibleView',
                                  params: {
                                    isReadOnly: true,
                                    book,
                                    chapter: Number(chapterKey),
                                    version,
                                    verse: 1
                                  }
                                })
                          }
                        >
                          {h1 && <H1>{h1}</H1>}
                          {h2 && <H2>{h2}</H2>}
                          {h3 && <H3>{h3}</H3>}
                          {h4 && <H4>{h4}</H4>}
                        </TouchableOpacity>
                      )
                    }
                  )}
                </React.Fragment>
              )
            })
          )}
        </Box>
      </ScrollView>
      <Box
        background
        row
        paddingHorizontal={20}
        paddingVertical={10}
        justifyContent="space-between"
      >
        {book.Numero != 1 && (
          <Link onPress={() => setBook(books[book.Numero - 2])}>
            <StyledIcon name="arrow-left" size={30} />
          </Link>
        )}
        {book.Numero != 66 && (
          <Link
            onPress={() => setBook(books[book.Numero])}
            style={{ marginLeft: 'auto' }}
          >
            <StyledIcon name="arrow-right" size={30} />
          </Link>
        )}
      </Box>
    </Container>
  )
}

export default PericopeScreen
