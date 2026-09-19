import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import { commentaryContext } from '~features/study-assistant/resourceContext'
import CommentIcon from '~common/CommentIcon'
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
import { staticResourceQueryOptions } from '~helpers/queryOptions'
import { getDefaultBibleTab, type CommentaryResourceTab, useBibleTabActions } from '~state/tabs'
import { openCommentaryBookSelector } from './commentaryBookSelector'
import CommentarySectionCard from './CommentarySectionCard'
import CommentaryRoomIntro from './CommentaryRoomIntro'
import { getCoveredCommentaryLocation } from './commentaryResourceNavigation'
import {
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
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null)
  const parsed = parseCommentaryResourceParams({
    projectionId: tab.data?.projectionId,
    book: String(tab.data?.book ?? ''),
    chapter: String(tab.data?.chapter ?? ''),
  })
  const selectSection = (sectionId: string) => {
    setTab(
      produce(draft => {
        draft.data.sectionId = sectionId
      })
    )
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }
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
    ...staticResourceQueryOptions,
  })
  const titleSection = tab.data.sectionId
    ? query.data?.sections.find(candidate => candidate.id === tab.data.sectionId)
    : undefined
  useAssistantResourceContext(`tab:${tab.id}`, commentaryContext(tab.data, titleSection))
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
    ...staticResourceQueryOptions,
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
        <Box className="overflow-hidden border-continuous flex-[1] bg-light-grey">
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
      <Box className="overflow-hidden border-continuous flex-[1] bg-light-grey">
        <Header background title={entry.author} subTitle={passage} />

        {tab.data.sectionId ? (
          query.isPending ? (
            <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
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
              ref={scrollRef}
              contentContainerStyle={{ maxWidth: 600, padding: 18, paddingBottom: 32 }}
            >
              <CommentarySectionCard
                entry={entry}
                language={projection.language}
                book={book}
                chapter={chapter}
                section={section}
                onResourcePress={() =>
                  router.push({
                    pathname: '/commentary-chapter',
                    params: {
                      projectionId: projection.projectionId,
                      book: String(book),
                      chapter: String(chapter),
                    },
                  })
                }
                onPrevious={previousSection ? () => selectSection(previousSection.id) : undefined}
                onNext={nextSection ? () => selectSection(nextSection.id) : undefined}
              />
            </ScrollView>
          )
        ) : (
          <ScrollView
            stickyHeaderIndices={[1]}
            contentContainerStyle={{ maxWidth: 600, padding: 18, paddingBottom: 32 }}
          >
            <CommentaryRoomIntro entry={entry} language={projection.language} />

            <Box className="overflow-hidden border-continuous flex-row items-center justify-between mx-[-18px] px-[18px] py-[8px] bg-light-grey z-[10]">
              <TouchableBox
                className="overflow-hidden border-continuous bg-light-grey rounded-[20px] h-[32px] px-[12px] flex-row items-center"
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
                <Text className="font-bold text-[14px]">
                  {bookLabel} {chapter}
                </Text>
                <FeatherIcon name="chevron-down" size={14} color="grey" style={{ marginLeft: 6 }} />
              </TouchableBox>
              {query.data ? (
                <Text className="text-grey text-[13px]">
                  {t('commentaries.resource.sectionCount', {
                    count: query.data.sections.length,
                  })}
                </Text>
              ) : null}
            </Box>

            {query.isPending ? (
              <Box className="overflow-hidden border-continuous py-[40px] items-center justify-center">
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
                iconElement={<CommentIcon size={36} />}
                message={t('commentaries.resource.emptyChapter')}
              />
            ) : (
              <Box className="overflow-hidden border-continuous mt-[16px] gap-[12px]">
                {query.data.sections.map(candidate => {
                  return (
                    <TouchableBox
                      className="overflow-hidden border-continuous bg-reverse rounded-[20px] px-[17px] py-[14px]"
                      key={candidate.id}
                      activeOpacity={0.62}
                      onPress={() =>
                        router.push({
                          pathname: '/commentary-entry',
                          params: {
                            projectionId: tab.data.projectionId,
                            book: String(tab.data.book),
                            chapter: String(tab.data.chapter),
                            sectionId: candidate.id,
                          },
                        })
                      }
                      accessibilityRole="button"
                      style={{
                        shadowColor: 'rgb(89,131,240)',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 7,
                        elevation: 1,
                        overflow: 'visible',
                      }}
                    >
                      <Box className="overflow-hidden border-continuous flex-row items-start">
                        <Box className="overflow-hidden border-continuous px-[10px] py-[5px] rounded-[12px] bg-light-primary">
                          <Text className="text-primary font-bold text-[12px]">
                            {formatRange(candidate.rangeStartVerse, candidate.rangeEndVerse)}
                          </Text>
                        </Box>
                        <Text
                          className="ml-[13px] flex-[1] text-grey text-[14px] leading-[20px]"
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
