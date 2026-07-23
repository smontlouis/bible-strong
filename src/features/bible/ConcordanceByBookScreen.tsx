import React, { useEffect, useState } from 'react'
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
import type { FoundVerseRow } from '~features/resources/strongAccess'
import { IS_FORM_SHEET } from '~helpers/constants'
import type { StrongLexiconEntry } from '~helpers/strongVerseParser'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import type { StrongBibleProvenance } from '~features/resources/strongBibleResourceAccess'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'

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
  const [verses, setVerses] = useState<FoundVerseRow[]>([])
  const isFormSheet = IS_FORM_SHEET
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
  const [strongResourceLanguage, setStrongResourceLanguage] = useResourceLanguage('STRONG')
  const defaultStrongBibleVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const requestedStrongBibleVersionId =
    (params.strongBibleVersionId as StrongBibleVersionId | undefined) ?? defaultStrongBibleVersionId
  const [provenance, setProvenance] = useState<StrongBibleProvenance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)

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

  const loadVersePage = async (offset: number, replace: boolean) => {
    if (!book || !Code || isLoading) return
    setIsLoading(true)
    try {
      const result = await resources.strongBible.loadFoundVersesByBook({
        currentVersionId: requestedStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        book,
        reference: Code,
        limit: PAGE_SIZE,
        offset,
      })
      if (result.status === 'available') {
        setVerses(current =>
          replace
            ? (result.verses as FoundVerseRow[])
            : [...current, ...(result.verses as FoundVerseRow[])]
        )
        setProvenance(result.provenance)
        setHasMore(result.verses.length === PAGE_SIZE)
      } else {
        if (replace) setVerses([])
        setProvenance(null)
        setHasMore(false)
      }
    } catch {
      toast(t('Impossible de charger les occurrences suivantes.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isCurrent = true
    const loadVerses = async () => {
      if (!book || !Code) return
      setIsLoading(true)
      setHasMore(true)
      setLexiconEntry({ Code, LSG: routeLexiconLsg })
      const [foundVersesResult, currentLexiconEntry] = await Promise.all([
        resources.strongBible.loadFoundVersesByBook({
          currentVersionId: requestedStrongBibleVersionId,
          defaultVersionId: defaultStrongBibleVersionId,
          book,
          reference: Code,
          limit: PAGE_SIZE,
          offset: 0,
        }),
        resources.strong.loadReference(String(Code), book),
      ])
      if (!isCurrent) return
      if (foundVersesResult.status === 'available') {
        setVerses(foundVersesResult.verses as FoundVerseRow[])
        setProvenance(foundVersesResult.provenance)
        setHasMore(foundVersesResult.verses.length === PAGE_SIZE)
      } else {
        setVerses([])
        setProvenance(null)
        setHasMore(false)
      }
      if (currentLexiconEntry && !('error' in currentLexiconEntry)) {
        setLexiconEntry(currentLexiconEntry)
      }
      setIsLoading(false)
    }
    loadVerses()
    return () => {
      isCurrent = false
    }
  }, [
    book,
    Code,
    defaultStrongBibleVersionId,
    requestedStrongBibleVersionId,
    resources.strong,
    resources.strongBible,
    routeLexiconLsg,
    strongResourceLanguage,
  ])

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
            if (hasMore && !isLoading) loadVersePage(verses.length, false)
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
