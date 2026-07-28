import React, { useEffect } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { MenuView } from '~common/ui/MenuView'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Text from '~common/ui/Text'
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
import type { Verse } from '~common/types'
import { IS_FORM_SHEET } from '~helpers/constants'
import type { StrongLexiconEntry } from '~helpers/strongVerseParser'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import type { StrongBibleProvenance } from '~features/resources/strongBibleResourceAccess'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import { createStrongIdentityForBook } from '~helpers/strongIdentities'

const PAGE_SIZE = 50

const ConcordanceByBook = () => {
  const pushRouteOnce = usePushRouteOnce()
  const resources = useResourceAccess()
  const params = useLocalSearchParams<{
    book: string
    strongReference: string
    strongBibleVersionId?: string
  }>()
  const { t } = useTranslation()
  const isFormSheet = IS_FORM_SHEET
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
  const [strongResourceLanguage, setStrongResourceLanguage] = useResourceLanguage('STRONG')
  const defaultStrongBibleVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const requestedStrongBibleVersionId =
    (params.strongBibleVersionId as StrongBibleVersionId | undefined) ?? defaultStrongBibleVersionId
  const book = params.book ? Number(params.book) : 0
  const strongReference = params.strongReference
    ? JSON.parse(params.strongReference)
    : { Code: 0, Mot: '' }
  const { Code, Mot } = strongReference
  const occurrencesQuery = useInfiniteQuery({
    queryKey: [
      'strong-occurrences-by-book',
      requestedStrongBibleVersionId,
      defaultStrongBibleVersionId,
      book,
      Code,
    ],
    queryFn: ({ pageParam }) =>
      resources.strongBible.loadFoundVersesByBook({
        currentVersionId: requestedStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        book,
        reference: Code,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.status === 'available' && lastPage.verses.length === PAGE_SIZE
        ? pages.reduce(
            (count, page) => count + (page.status === 'available' ? page.verses.length : 0),
            0
          )
        : undefined,
    enabled: Boolean(book && Code),
  })
  const verses =
    occurrencesQuery.data?.pages.flatMap(page =>
      page.status === 'available' ? page.verses : []
    ) ?? []
  const availablePage = occurrencesQuery.data?.pages.find(page => page.status === 'available')
  const provenance: StrongBibleProvenance | null =
    availablePage?.status === 'available' ? availablePage.provenance : null
  const isLoading = occurrencesQuery.isPending || occurrencesQuery.isFetchingNextPage

  const { data: loadedLexiconEntry } = useQuery({
    queryKey: ['strong-lexicon-entry', strongResourceLanguage, Code, book],
    queryFn: async () =>
      (await resources.strongLexicon.loadEntry(
        createStrongIdentityForBook(String(Code), book),
        strongResourceLanguage
      )) ?? null,
    enabled: Boolean(book && Code),
  })
  const lexiconEntry: StrongLexiconEntry = loadedLexiconEntry
    ? { Code: loadedLexiconEntry.baseCode, LSG: loadedLexiconEntry.gloss }
    : { Code, LSG: strongReference.LSG || '' }

  useEffect(() => {
    if (occurrencesQuery.isFetchNextPageError) {
      toast(t('Impossible de charger les occurrences suivantes.'))
    }
  }, [occurrencesQuery.isFetchNextPageError, t])

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
        }${provenance ? ` · ${provenance.versionId}` : ''}`}
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
      {!verses.length && isLoading && (
        <Box flex>
          <Loading />
        </Box>
      )}
      {(!isLoading || !!verses.length) && (
        <FlatList
          contentContainerStyle={{ padding: 20 }}
          removeClippedSubviews
          data={verses}
          onEndReached={() => {
            if (occurrencesQuery.hasNextPage && !occurrencesQuery.isFetchingNextPage) {
              occurrencesQuery.fetchNextPage()
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Box py={40} px={20} center>
              <Text color="grey">{t('Aucune occurrence disponible.')}</Text>
            </Box>
          }
          ListFooterComponent={
            isLoading && verses.length ? (
              <Box height={72}>
                <Loading />
              </Box>
            ) : null
          }
          keyExtractor={(item: Verse) => `${item.Livre}-${item.Chapitre}-${item.Verset}`}
          renderItem={({ item }: { item: Verse }) => {
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
                      version: provenance?.versionId,
                      strongMode: provenance ? 'visible' : undefined,
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
