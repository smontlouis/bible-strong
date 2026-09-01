import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import Header from '~common/Header'
import Loading from '~common/Loading'
import StylizedHTMLView from '~common/StylizedHTMLView'
import ScrollView from '~common/ui/ScrollView'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getBook } from '~helpers/bibleBookCatalog'
import { IS_FORM_SHEET } from '~helpers/constants'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import CommentaryResourceHeaderActions from './CommentaryResourceHeaderActions'
import CommentaryRoomIntro from './CommentaryRoomIntro'
import {
  getCommentaryBibleViewRoute,
  getCommentaryPassageBibleViewRoute,
} from './commentaryReferenceNavigation'
import { commentaryHrefToOsis, parseCommentaryResourceParams } from './commentaryResourceParams'
import CommentaryEntryNavigation from './CommentaryEntryNavigation'

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
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null)
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
  const sectionIndex = query.data?.sections.findIndex(
    candidate => candidate.id === params.sectionId
  )
  const previousSection =
    sectionIndex !== undefined && sectionIndex > 0
      ? query.data?.sections[sectionIndex - 1]
      : undefined
  const nextSection =
    sectionIndex !== undefined && sectionIndex >= 0
      ? query.data?.sections[sectionIndex + 1]
      : undefined
  const bookLabel = getBook(book)?.Nom ?? String(book)
  const passage = section
    ? `${bookLabel} ${chapter}:${section.rangeStartVerse}${
        section.rangeEndVerse !== section.rangeStartVerse ? `–${section.rangeEndVerse}` : ''
      }`
    : `${bookLabel} ${chapter}`

  return (
    <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
      <Box flex bg="lightGrey">
        <Header
          background
          hasBackButton={IS_FORM_SHEET ? canGoBackInStack : true}
          title={entry.author}
          subTitle={passage}
          rightComponent={
            <Box mr={4}>
              <CommentaryResourceHeaderActions
                entry={entry}
                projectionId={projection.projectionId}
                language={projection.language}
                book={book}
                chapter={chapter}
                sectionId={params.sectionId}
                showAvatar={false}
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
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 18, paddingBottom: 44 }}>
            <CommentaryRoomIntro
              compact
              entry={entry}
              language={projection.language}
              onPress={() =>
                router.replace({
                  pathname: '/commentary-chapter',
                  params: {
                    projectionId: projection.projectionId,
                    book: String(book),
                    chapter: String(chapter),
                  },
                })
              }
            />
            <Box bg="reverse" rounded lightShadow px={18} py={18}>
              <CommentaryEntryNavigation
                hasPrevious={Boolean(previousSection)}
                hasNext={Boolean(nextSection)}
                reference={
                  section.rangeStartVerse === 0 && section.rangeEndVerse === 0
                    ? t('commentaries.resource.introduction')
                    : passage
                }
                referenceDisabled={section.rangeStartVerse === 0}
                onReferencePress={() => {
                  const route = getCommentaryPassageBibleViewRoute({
                    book,
                    chapter,
                    startVerse: section.rangeStartVerse,
                    endVerse: section.rangeEndVerse,
                  })
                  if (route) router.push(route)
                }}
                onPrevious={() => {
                  if (!previousSection) return
                  router.setParams({ sectionId: previousSection.id })
                  scrollRef.current?.scrollTo({ y: 0, animated: true })
                }}
                onNext={() => {
                  if (!nextSection) return
                  router.setParams({ sectionId: nextSection.id })
                  scrollRef.current?.scrollTo({ y: 0, animated: true })
                }}
              />
              <Box mt={14}>
                <StylizedHTMLView
                  value={section.content}
                  onLinkPress={href => {
                    const osis = commentaryHrefToOsis(href)
                    const route = osis ? getCommentaryBibleViewRoute(osis) : undefined
                    if (route) router.push(route)
                    else if (/^https?:\/\//iu.test(href)) void Linking.openURL(href)
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
