import { useQuery } from '@tanstack/react-query'
import { produce } from 'immer'
import { useAtom, useAtomValue } from 'jotai/react'
import { atom, type PrimitiveAtom } from 'jotai/vanilla'
import { useRouter } from 'expo-router'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import StylizedHTMLView from '~common/StylizedHTMLView'
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
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { getDefaultBibleTab, type CommentaryResourceTab, useBibleTabActions } from '~state/tabs'
import { openCommentaryBookSelector } from './commentaryBookSelector'
import CommentaryEntryNavigation from './CommentaryEntryNavigation'
import CommentaryRoomIntro from './CommentaryRoomIntro'
import {
  getCommentaryBibleViewRoute,
  getCommentaryPassageBibleViewRoute,
} from './commentaryReferenceNavigation'
import { getCoveredCommentaryLocation } from './commentaryResourceNavigation'
import {
  commentaryHrefToOsis,
  formatCommentaryResourceTabTitle,
  parseCommentaryResourceParams,
} from './commentaryResourceParams'

const formatRange = (start: number, end: number) => (start === end ? `${start}` : `${start}–${end}`)

const CommentaryResourceTabScreen = ({
  commentaryAtom,
}: {
  commentaryAtom: PrimitiveAtom<CommentaryResourceTab>
}) => {
  const [tab, setTab] = useAtom(commentaryAtom)
  const parsed = parseCommentaryResourceParams({
    projectionId: tab.data?.projectionId,
    book: String(tab.data?.book ?? ''),
    chapter: String(tab.data?.chapter ?? ''),
  })
  const resources = useResourceAccess()
  const router = useRouter()
  const { t } = useTranslation()
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
  const detailScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null)

  useEffect(() => {
    if (!parsed) return
    const nextBook = selectorTab.data.selectedBook.Numero
    const nextChapter = selectorTab.data.selectedChapter
    if (nextBook === parsed.book && nextChapter === parsed.chapter) return
    setTab(
      produce(draft => {
        draft.data.book = nextBook
        draft.data.chapter = nextChapter
        draft.data.sectionId = undefined
      })
    )
  }, [parsed, selectorTab.data.selectedBook.Numero, selectorTab.data.selectedChapter, setTab])

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
  const titleSection = tab.data.sectionId
    ? query.data?.sections.find(candidate => candidate.id === tab.data.sectionId)
    : undefined
  const titleBookLabel = parsed ? (getBook(parsed.book)?.Nom ?? String(parsed.book)) : undefined
  const desiredTabTitle =
    parsed && titleBookLabel
      ? formatCommentaryResourceTabTitle({
          shortName: parsed.entry.shortName,
          bookLabel: titleBookLabel,
          chapter: parsed.chapter,
          range: titleSection
            ? { start: titleSection.rangeStartVerse, end: titleSection.rangeEndVerse }
            : undefined,
        })
      : undefined

  useEffect(() => {
    if (!desiredTabTitle || tab.title === desiredTabTitle) return
    setTab(
      produce(draft => {
        draft.title = desiredTabTitle
      })
    )
  }, [desiredTabTitle, setTab, tab.title])

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
      <FormSheetScreen isFormSheet={false}>
        <Box flex bg="lightGrey">
          <Header background title={t('Commentaires')} />
          <ResourceUnavailableView
            title={t('commentaries.resource.invalid')}
            failure={{ cause: 'not-found', recoveries: [] }}
          />
        </Box>
      </FormSheetScreen>
    )
  }

  const { entry, projection, book, chapter } = parsed
  const section = tab.data.sectionId
    ? query.data?.sections.find(candidate => candidate.id === tab.data.sectionId)
    : undefined
  const sectionIndex = tab.data.sectionId
    ? query.data?.sections.findIndex(candidate => candidate.id === tab.data.sectionId)
    : undefined
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
    ? `${bookLabel} ${chapter}:${formatRange(section.rangeStartVerse, section.rangeEndVerse)}`
    : undefined
  return (
    <FormSheetScreen isFormSheet={false}>
      <Box flex bg="lightGrey">
        <Header
          background
          hasBackButton={Boolean(tab.data.sectionId)}
          onCustomBackPress={() =>
            setTab(
              produce(draft => {
                draft.data.sectionId = undefined
              })
            )
          }
          title={entry.author}
          subTitle={passage}
        />

        {tab.data.sectionId ? (
          query.isPending ? (
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
            <ScrollView
              ref={detailScrollRef}
              contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
            >
              <CommentaryRoomIntro
                compact
                entry={entry}
                language={projection.language}
                onPress={() =>
                  setTab(
                    produce(draft => {
                      draft.data.sectionId = undefined
                    })
                  )
                }
              />
              <Box bg="reverse" rounded lightShadow px={18} py={18}>
                <CommentaryEntryNavigation
                  hasPrevious={Boolean(previousSection)}
                  hasNext={Boolean(nextSection)}
                  reference={
                    section.rangeStartVerse === 0 && section.rangeEndVerse === 0
                      ? t('commentaries.resource.introduction')
                      : passage!
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
                    setTab(
                      produce(draft => {
                        draft.data.sectionId = previousSection.id
                      })
                    )
                    detailScrollRef.current?.scrollTo({ y: 0, animated: true })
                  }}
                  onNext={() => {
                    if (!nextSection) return
                    setTab(
                      produce(draft => {
                        draft.data.sectionId = nextSection.id
                      })
                    )
                    detailScrollRef.current?.scrollTo({ y: 0, animated: true })
                  }}
                />
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
          )
        ) : (
          <ScrollView
            stickyHeaderIndices={[1]}
            contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
          >
            <CommentaryRoomIntro entry={entry} language={projection.language} />

            <Box
              row
              alignItems="center"
              justifyContent="space-between"
              mx={-18}
              px={18}
              py={8}
              bg="lightGrey"
              zIndex={10}
            >
              <TouchableBox
                bg="lightGrey"
                borderRadius={20}
                height={32}
                px={12}
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
                <Text bold fontSize={14}>
                  {bookLabel} {chapter}
                </Text>
                <FeatherIcon name="chevron-down" size={14} color="grey" style={{ marginLeft: 6 }} />
              </TouchableBox>
              {query.data ? (
                <Text color="grey" fontSize={13}>
                  {t('commentaries.resource.commentaryCount', {
                    count: query.data.sections.length,
                  })}
                </Text>
              ) : null}
            </Box>

            {query.isPending ? (
              <Box py={40} center>
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
              <Box mt={16} gap={12}>
                {query.data.sections.map(candidate => {
                  return (
                    <TouchableBox
                      key={candidate.id}
                      bg="reverse"
                      rounded
                      lightShadow
                      px={17}
                      py={14}
                      activeOpacity={0.62}
                      onPress={() =>
                        setTab(
                          produce(draft => {
                            draft.data.sectionId = candidate.id
                          })
                        )
                      }
                      accessibilityRole="button"
                    >
                      <Box row alignItems="flex-start">
                        <Box px={10} py={5} borderRadius={12} bg="lightPrimary">
                          <Text color="primary" bold fontSize={12}>
                            {formatRange(candidate.rangeStartVerse, candidate.rangeEndVerse)}
                          </Text>
                        </Box>
                        <Text
                          ml={13}
                          flex
                          color="grey"
                          fontSize={14}
                          lineHeight={20}
                          numberOfLines={2}
                        >
                          {candidate.preview}
                        </Text>
                        <FeatherIcon name="chevron-right" size={20} color="grey" />
                      </Box>
                    </TouchableBox>
                  )
                })}
              </Box>
            )}
          </ScrollView>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default CommentaryResourceTabScreen
