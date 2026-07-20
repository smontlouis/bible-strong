import React, { useEffect, useState } from 'react'
import { MenuView } from '~common/ui/MenuView'
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

import { getBook } from '~helpers/bibleBookCatalog'
import truncate from '~helpers/truncate'
import { toast } from '~helpers/toast'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { FoundVerseRow } from '~features/resources/strongAccess'
import { IS_FORM_SHEET } from '~helpers/constants'
import type { StrongLexiconEntry } from '~helpers/strongVerseParser'

const ConcordanceByBook = () => {
  const pushRouteOnce = usePushRouteOnce()
  const resources = useResourceAccess()
  const params = useLocalSearchParams<{ book: string; strongReference: string }>()
  const { t } = useTranslation()
  const [verses, setVerses] = useState<FoundVerseRow[]>([])
  const isFormSheet = IS_FORM_SHEET
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
  const [strongResourceLanguage, setStrongResourceLanguage] = useResourceLanguage('STRONG')

  const book = params.book ? Number(params.book) : 0
  const strongReference = params.strongReference
    ? JSON.parse(params.strongReference)
    : { Code: 0, Mot: '' }
  const { Code, Mot } = strongReference
  const routeLexiconLsg = strongReference.LSG || ''
  const [lexiconEntry, setLexiconEntry] = useState<StrongLexiconEntry>({
    Code,
    LSG: routeLexiconLsg,
  })

  useEffect(() => {
    let isCurrent = true
    const loadVerses = async () => {
      if (!book || !Code) return
      setLexiconEntry({ Code, LSG: routeLexiconLsg })
      const [foundVerses, currentLexiconEntry] = await Promise.all([
        resources.strong.loadFoundVersesByBook(book, Code),
        resources.strong.loadReference(String(Code), book),
      ])
      if (!isCurrent || 'error' in foundVerses) return
      setVerses(foundVerses)
      if (currentLexiconEntry && !('error' in currentLexiconEntry)) {
        setLexiconEntry(currentLexiconEntry)
      }
    }
    loadVerses()
    return () => {
      isCurrent = false
    }
  }, [book, Code, resources.strong, routeLexiconLsg, strongResourceLanguage])

  const toggleStrongLanguage = () => {
    const nextLanguage = strongResourceLanguage === 'fr' ? 'en' : 'fr'
    setStrongResourceLanguage(nextLanguage)
    toast(t('menu.languageChanged', { language: nextLanguage === 'fr' ? 'Français' : 'English' }))
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={`${truncate(Mot, 7)} dans ${
          getBook(book)?.Nom || t('Livre {{bookNumber}}', { bookNumber: book })
        }`}
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
                lexiconEntry={lexiconEntry}
                verse={item}
                t={t}
                onOpenVerse={verse => {
                  const bookNumber = Number(verse.Livre)
                  const verseNumber = Number(verse.Verset)

                  pushRouteOnce({
                    pathname: '/bible-view',
                    params: {
                      contextDisplayMode: 'focused',
                      book: JSON.stringify(getBook(bookNumber)),
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
