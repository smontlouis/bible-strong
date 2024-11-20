import React, { useEffect, useState } from 'react'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import Header from '~common/Header'
import Loading from '~common/Loading'
import waitForStrongDB from '~common/waitForStrongDB'
import ConcordanceVerse from './ConcordanceVerse'

import books from '~assets/bible_versions/books-desc'
import loadFoundVersesByBook from '~helpers/loadFoundVersesByBook'
import truncate from '~helpers/truncate'
import { MainStackProps } from '~navigation/type'

interface Verse {
  Livre: number
  Chapitre: number
  Verset: number
  [key: string]: any
}

const ConcordanceByBook = () => {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MainStackProps, 'ConcordanceByBook'>>()
  const { t } = useTranslation()
  const [verses, setVerses] = useState<Verse[]>([])

  useEffect(() => {
    const loadVerses = async () => {
      const {
        book,
        strongReference: { Code },
      } = route.params
      const foundVerses = await loadFoundVersesByBook(book, Code)
      setVerses(foundVerses)
    }
    loadVerses()
  }, [route.params])

  const {
    book,
    strongReference: { Code, Mot },
  } = route.params

  return (
    <Container>
      <Header
        hasBackButton
        title={`${truncate(Mot, 7)} dans ${books[book - 1].Nom}`}
      />
      {!verses.length && (
        <Box flex>
          <Loading />
        </Box>
      )}
      {!!verses.length && (
        <Box flex>
          <FlatList
            contentContainerStyle={{ padding: 20 }}
            removeClippedSubviews
            data={verses}
            keyExtractor={item =>
              `${item.Livre}-${item.Chapitre}-${item.Verset}`
            }
            renderItem={({ item }) => (
              <ConcordanceVerse
                navigation={navigation}
                concordanceFor={Code}
                verse={item}
                t={t}
              />
            )}
          />
        </Box>
      )}
    </Container>
  )
}

export default waitForStrongDB({
  hasBackButton: true,
  hasHeader: true,
})(ConcordanceByBook)
