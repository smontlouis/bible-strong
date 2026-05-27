import React, { useEffect, useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Header from '~common/Header'
import Loading from '~common/Loading'
import PopOverMenu from '~common/PopOverMenu'
import LanguageMenuOption from '~common/LanguageMenuOption'
import waitForStrongDB from '~common/waitForStrongDB'
import ConcordanceVerse from './ConcordanceVerse'

import books from '~assets/bible_versions/books-desc'
import loadFoundVersesByBook, { FoundVerseRow } from '~helpers/loadFoundVersesByBook'
import truncate from '~helpers/truncate'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'

const ConcordanceByBook = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ book: string; strongReference: string }>()
  const { t } = useTranslation()
  const [verses, setVerses] = useState<FoundVerseRow[]>([])
  const canGoBackInStack = useCanGoBackInStack()

  const book = params.book ? Number(params.book) : 0
  const strongReference = params.strongReference
    ? JSON.parse(params.strongReference)
    : { Code: 0, Mot: '' }
  const { Code, Mot } = strongReference

  useEffect(() => {
    const loadVerses = async () => {
      if (!book || !Code) return
      const foundVerses = await loadFoundVersesByBook(book, Code)
      if ('error' in foundVerses) return
      setVerses(foundVerses)
    }
    loadVerses()
  }, [book, Code])

  return (
    <FormSheetScreen isFormSheet>
      <Header
        hasBackButton={canGoBackInStack}
        title={`${truncate(Mot, 7)} dans ${books[book - 1].Nom}`}
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <LanguageMenuOption resourceId="STRONG" />
              </>
            }
          />
        }
      />
      {!verses.length && (
        <Box flex>
          <Loading />
        </Box>
      )}
      {!!verses.length && (
        <FlatList
          contentContainerStyle={{ padding: 20 }}
          removeClippedSubviews
          data={verses}
          keyExtractor={(item: FoundVerseRow) => `${item.Livre}-${item.Chapitre}-${item.Verset}`}
          renderItem={({ item }: { item: FoundVerseRow }) => {
            const props = {
              router,
              concordanceFor: Code,
              verse: item,
              t,
            }
            return <ConcordanceVerse {...props} />
          }}
        />
      )}
    </FormSheetScreen>
  )
}

export default waitForStrongDB({
  hasBackButton: true,
  hasHeader: true,
  useStackBackButton: true,
})(ConcordanceByBook)
