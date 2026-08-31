import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import ScrollView from '~common/ui/ScrollView'
import Box, { TouchableBox } from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getBook } from '~helpers/bibleBookCatalog'
import { IS_FORM_SHEET } from '~helpers/constants'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { getDefaultBibleTab, useBibleTabActions } from '~state/tabs'
import { openCommentaryBookSelector } from './commentaryBookSelector'
import CommentaryResourceHeaderActions from './CommentaryResourceHeaderActions'
import { getCoveredCommentaryLocation } from './commentaryResourceNavigation'
import { parseCommentaryResourceParams } from './commentaryResourceParams'

const formatRange = (start: number, end: number, introductionLabel: string) => {
  if (start === 0 && end === 0) return introductionLabel
  return start === end ? `${start}` : `${start}–${end}`
}

const CommentaryChapterScreen = () => {
  const params = useLocalSearchParams<{
    projectionId?: string
    book?: string
    chapter?: string
    focusVerse?: string
  }>()
  const parsed = parseCommentaryResourceParams(params)
  const focusVerse = Number(params.focusVerse)
  const resources = useResourceAccess()
  const router = useRouter()
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
  const { openBookSelector } = useBookAndVersionSelector()
  const [selectorAtom] = React.useState(() => {
    const initial = getDefaultBibleTab()
    const selectedBook = getBook(parsed?.book ?? 1) ?? getBook(1)!
    initial.data.selectedBook = selectedBook
    initial.data.selectedChapter = parsed?.chapter ?? 1
    initial.data.selectedVerse = 1
    initial.data.temp = {
      selectedBook,
      selectedChapter: parsed?.chapter ?? 1,
      selectedVerse: 1,
    }
    return atom(initial)
  })
  const selectorTab = useAtomValue(selectorAtom)
  const selectorActions = useBibleTabActions(selectorAtom)

  useEffect(() => {
    if (!parsed) return
    const nextBook = selectorTab.data.selectedBook.Numero
    const nextChapter = selectorTab.data.selectedChapter
    if (nextBook === parsed.book && nextChapter === parsed.chapter) return
    router.setParams({
      book: String(nextBook),
      chapter: String(nextChapter),
      focusVerse: undefined,
    })
  }, [parsed, router, selectorTab.data.selectedBook.Numero, selectorTab.data.selectedChapter])

  const query = useQuery({
    queryKey: [
      'commentary-resource-chapter',
      parsed?.projection.projectionId,
      parsed?.book,
      parsed?.chapter,
    ],
    queryFn: () =>
      resources.commentary.loadResourceChapter({
        resourceId: parsed!.projection.resourceId,
        language: parsed!.projection.language,
        book: parsed!.book,
        chapter: parsed!.chapter,
      }),
    enabled: Boolean(parsed),
    networkMode: 'always',
    retry: false,
  })
  const coverageQuery = useQuery({
    queryKey: resourceQueryKeys.commentaryCoverage(
      parsed?.projection.resourceId ?? '',
      parsed?.projection.language ?? ''
    ),
    queryFn: () =>
      resources.commentary.loadResourceCoverage({
        resourceId: parsed!.projection.resourceId,
        language: parsed!.projection.language,
      }),
    enabled: Boolean(parsed),
    networkMode: 'always',
    retry: false,
  })

  useEffect(() => {
    if (!parsed || !coverageQuery.data) return
    const location = getCoveredCommentaryLocation(coverageQuery.data, parsed)
    if (!location || (location.book === parsed.book && location.chapter === parsed.chapter)) return
    const selectedBook = getBook(location.book)
    if (!selectedBook) return
    selectorActions.setSelectedBook(selectedBook)
    selectorActions.setSelectedChapter(location.chapter)
    selectorActions.setTempSelectedBook(selectedBook)
    selectorActions.setTempSelectedChapter(location.chapter)
  }, [coverageQuery.data, parsed, selectorActions])

  if (!parsed) {
    return (
      <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
        <ResourceUnavailableView
          title={t('commentaries.resource.invalid')}
          failure={{ cause: 'not-found', recoveries: [] }}
        />
      </FormSheetScreen>
    )
  }

  const { entry, projection, book, chapter } = parsed
  const bookLabel = getBook(book)?.Nom ?? String(book)

  return (
    <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
      <Box flex bg="lightGrey">
        <Header
          background
          hasBackButton={IS_FORM_SHEET ? canGoBackInStack : true}
          title={entry.title}
          subTitle={entry.author}
          rightComponent={
            <Box mr={4}>
              <CommentaryResourceHeaderActions
                entry={entry}
                projectionId={projection.projectionId}
                language={projection.language}
                book={book}
                chapter={chapter}
              />
            </Box>
          }
        />
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <TouchableBox
            bg="reverse"
            rounded
            lightShadow
            minHeight={64}
            px={18}
            row
            alignItems="center"
            onPress={() => {
              openCommentaryBookSelector({
                openBookSelector,
                actions: selectorActions,
                data: selectorTab.data,
                coverage: coverageQuery.data,
              })
            }}
            accessibilityRole="button"
            accessibilityLabel={t('commentaries.resource.chooseChapter')}
          >
            <FeatherIcon name="book-open" size={21} color="primary" />
            <Text ml={12} bold fontSize={18} flex>
              {bookLabel} {chapter}
            </Text>
            {query.data ? (
              <Text color="grey" fontSize={13} mr={8}>
                {t('commentaries.resource.sectionCount', { count: query.data.sections.length })}
              </Text>
            ) : null}
            <FeatherIcon name="chevron-down" size={19} color="grey" />
          </TouchableBox>

          {query.isPending ? (
            <Box minHeight={180} center>
              <Loading />
            </Box>
          ) : query.isError ? (
            <ResourceUnavailableView
              title={t('commentaries.resource.unavailable')}
              failure={resourceFailureFromAccessError(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : query.data.sections.length === 0 ? (
            <Empty
              icon={require('~assets/images/empty-state-icons/comment.svg')}
              message={t('commentaries.resource.emptyChapter')}
            />
          ) : (
            <Box mt={18} gap={14}>
              {query.data.sections.map(section => {
                const highlighted =
                  Number.isSafeInteger(focusVerse) &&
                  focusVerse >= section.rangeStartVerse &&
                  focusVerse <= section.rangeEndVerse
                const passage = `${bookLabel} ${chapter}:${formatRange(
                  section.rangeStartVerse,
                  section.rangeEndVerse,
                  t('commentaries.resource.introduction')
                )}`
                return (
                  <TouchableBox
                    key={section.id}
                    bg="reverse"
                    rounded
                    lightShadow
                    px={17}
                    py={16}
                    borderWidth={highlighted ? 2 : 0}
                    borderColor="primary"
                    activeOpacity={0.62}
                    onPress={() =>
                      router.push({
                        pathname: '/commentary-entry',
                        params: {
                          projectionId: projection.projectionId,
                          book: String(book),
                          chapter: String(chapter),
                          sectionId: section.id,
                        },
                      })
                    }
                    accessibilityRole="button"
                  >
                    <Box row alignItems="flex-start">
                      <Box px={11} py={7} borderRadius={14} bg="lightPrimary">
                        <Text color="primary" bold fontSize={15}>
                          {formatRange(
                            section.rangeStartVerse,
                            section.rangeEndVerse,
                            t('commentaries.resource.introduction')
                          )}
                        </Text>
                      </Box>
                      <Box ml={13} flex>
                        <Text bold fontSize={18} numberOfLines={2}>
                          {section.title ?? passage}
                        </Text>
                        {highlighted ? (
                          <Text color="primary" fontSize={12} mt={3}>
                            {t('commentaries.resource.containsCurrentVerse')}
                          </Text>
                        ) : null}
                      </Box>
                      <FeatherIcon name="chevron-right" size={20} color="grey" />
                    </Box>
                    <Text mt={11} color="grey" fontSize={15} lineHeight={21} numberOfLines={4}>
                      {section.preview}
                    </Text>
                  </TouchableBox>
                )
              })}
            </Box>
          )}
        </ScrollView>
      </Box>
    </FormSheetScreen>
  )
}

export default CommentaryChapterScreen
