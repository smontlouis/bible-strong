import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'

import Header from '~common/Header'
import Loading from '~common/Loading'
import StylizedHTMLView from '~common/StylizedHTMLView'
import ScrollView from '~common/ui/ScrollView'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getBook } from '~helpers/bibleBookCatalog'
import { IS_FORM_SHEET } from '~helpers/constants'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import CommentaryResourceHeaderActions from './CommentaryResourceHeaderActions'
import { getCommentaryBibleViewRoute } from './commentaryReferenceNavigation'
import { commentaryHrefToOsis, parseCommentaryResourceParams } from './commentaryResourceParams'

const CommentaryEntryScreen = () => {
  const params = useLocalSearchParams<{
    projectionId?: string
    book?: string
    chapter?: string
    sectionId?: string
  }>()
  const parsed = parseCommentaryResourceParams(params)
  const resources = useResourceAccess()
  const router = useRouter()
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
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
    enabled: Boolean(parsed && params.sectionId),
    networkMode: 'always',
    retry: false,
  })

  if (!parsed || !params.sectionId) {
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
  const section = query.data?.sections.find(candidate => candidate.id === params.sectionId)
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
                sectionId={params.sectionId}
              />
            </Box>
          }
        />
        {query.isPending ? (
          <Box flex center>
            <Loading />
          </Box>
        ) : query.isError ? (
          <ResourceUnavailableView
            title={t('commentaries.resource.unavailable')}
            failure={resourceFailureFromAccessError(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !section ? (
          <ResourceUnavailableView
            title={t('commentaries.resource.sectionMissing')}
            failure={{ cause: 'not-found', recoveries: [] }}
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 44 }}>
            <Box bg="reverse" rounded lightShadow px={18} py={18}>
              <Box alignSelf="flex-start" px={11} py={7} borderRadius={14} bg="lightPrimary">
                <Text color="primary" bold>
                  {section.rangeStartVerse === 0 && section.rangeEndVerse === 0
                    ? t('commentaries.resource.introduction')
                    : `${bookLabel} ${chapter}:${section.rangeStartVerse}${
                        section.rangeEndVerse !== section.rangeStartVerse
                          ? `–${section.rangeEndVerse}`
                          : ''
                      }`}
                </Text>
              </Box>
              {section.title ? (
                <Text mt={16} bold fontSize={22} lineHeight={27}>
                  {section.title}
                </Text>
              ) : null}
              <Box mt={14}>
                <StylizedHTMLView
                  value={section.content}
                  onLinkPress={href => {
                    const osis = commentaryHrefToOsis(href)
                    const route = osis ? getCommentaryBibleViewRoute(osis) : undefined
                    if (route) router.push(route)
                  }}
                />
              </Box>
            </Box>
          </ScrollView>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default CommentaryEntryScreen
