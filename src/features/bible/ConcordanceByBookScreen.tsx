import React, { useEffect, useState } from 'react'
import { MenuView } from '@expo/ui/community/menu'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Header from '~common/Header'
import Loading from '~common/Loading'
import waitForStrongDB from '~common/waitForStrongDB'
import ConcordanceVerse from './ConcordanceVerse'
import { FeatherIcon } from '~common/ui/Icon'

import books from '~assets/bible_versions/books-desc'
import loadFoundVersesByBook, { FoundVerseRow } from '~helpers/loadFoundVersesByBook'
import truncate from '~helpers/truncate'
import { toast } from '~helpers/toast'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

const ConcordanceByBook = () => {
  const pushRouteOnce = usePushRouteOnce()
  const params = useLocalSearchParams<{ book: string; strongReference: string }>()
  const { t } = useTranslation()
  const [verses, setVerses] = useState<FoundVerseRow[]>([])
  const canGoBackInStack = useCanGoBackInStack()
  const [strongResourceLanguage, setStrongResourceLanguage] = useResourceLanguage('STRONG')

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

  const toggleStrongLanguage = () => {
    const nextLanguage = strongResourceLanguage === 'fr' ? 'en' : 'fr'
    setStrongResourceLanguage(nextLanguage)
    toast(t('menu.languageChanged', { language: nextLanguage === 'fr' ? 'Français' : 'English' }))
  }

  return (
    <FormSheetScreen isFormSheet>
      <Header
        hasBackButton={canGoBackInStack}
        title={`${truncate(Mot, 7)} dans ${books[book - 1].Nom}`}
        rightComponent={
          <MenuView
            actions={[
              {
                id: 'language',
                title: `${t('menu.language')}: ${
                  strongResourceLanguage === 'fr' ? 'Français' : 'English'
                }`,
                image: 'globe',
              },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'language') toggleStrongLanguage()
            }}
          >
            <Box row center height={60} width={60}>
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
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
            return (
              <ConcordanceVerse
                concordanceFor={Code}
                verse={item}
                t={t}
                onOpenVerse={verse => {
                  const bookNumber = Number(verse.Livre)
                  const verseNumber = Number(verse.Verset)

                  pushRouteOnce({
                    pathname: '/bible-view',
                    params: {
                      contextDisplayMode: 'focused',
                      book: JSON.stringify(books[bookNumber - 1]),
                      chapter: String(verse.Chapitre),
                      verse: String(verseNumber),
                      focusVerses: JSON.stringify([verseNumber]),
                    },
                  })
                }}
              />
            )
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
