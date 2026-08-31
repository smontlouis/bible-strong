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
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getBook } from '~helpers/bibleBookCatalog'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { getDefaultBibleTab, type CommentaryResourceTab, useBibleTabActions } from '~state/tabs'
import { openCommentaryBookSelector } from './commentaryBookSelector'
import CommentaryAvatar from './CommentaryAvatar'
import { getCommentaryBibleViewRoute } from './commentaryReferenceNavigation'
import { getCoveredCommentaryLocation } from './commentaryResourceNavigation'
import { commentaryHrefToOsis, parseCommentaryResourceParams } from './commentaryResourceParams'

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
  const { bottomBarHeight } = useBottomBarHeightInTab()
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

  useEffect(() => {
    if (!parsed || tab.title === parsed.entry.shortName) return
    setTab(
      produce(draft => {
        draft.title = parsed.entry.shortName
      })
    )
  }, [parsed, setTab, tab.title])

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
      <Box flex bg="lightGrey">
        <Header background title={t('Commentaires')} />
        <ResourceUnavailableView
          title={t('commentaries.resource.invalid')}
          failure={{ cause: 'not-found', recoveries: [] }}
        />
      </Box>
    )
  }

  const { entry, projection, book, chapter } = parsed
  const section = tab.data.sectionId
    ? query.data?.sections.find(candidate => candidate.id === tab.data.sectionId)
    : undefined
  const bookLabel = getBook(book)?.Nom ?? String(book)
  const avatar = (
    <Box mr={14}>
      <CommentaryAvatar
        resourceCode={`${entry.publicationId}:${projection.language}`}
        author={entry.author}
        fallback={entry.shortName}
        size={42}
      />
    </Box>
  )

  return (
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
        title={entry.title}
        subTitle={entry.author}
        rightComponent={avatar}
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
      ) : tab.data.sectionId ? (
        !section ? (
          <ResourceUnavailableView
            title={t('commentaries.resource.sectionMissing')}
            failure={{ cause: 'not-found', recoveries: [] }}
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomBarHeight + 32 }}>
            <Box bg="reverse" rounded lightShadow px={18} py={18}>
              <Box alignSelf="flex-start" px={11} py={7} borderRadius={14} bg="lightPrimary">
                <Text color="primary" bold>
                  {bookLabel} {chapter}:
                  {formatRange(section.rangeStartVerse, section.rangeEndVerse)}
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
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomBarHeight + 32 }}>
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
            <Text color="grey" fontSize={13} mr={8}>
              {t('commentaries.resource.sectionCount', { count: query.data.sections.length })}
            </Text>
            <FeatherIcon name="chevron-down" size={19} color="grey" />
          </TouchableBox>

          {query.data.sections.length === 0 ? (
            <Empty
              icon={require('~assets/images/empty-state-icons/comment.svg')}
              message={t('commentaries.resource.emptyChapter')}
            />
          ) : (
            <Box mt={18} gap={14}>
              {query.data.sections.map(candidate => {
                const passage = `${bookLabel} ${chapter}:${formatRange(
                  candidate.rangeStartVerse,
                  candidate.rangeEndVerse
                )}`
                return (
                  <TouchableBox
                    key={candidate.id}
                    bg="reverse"
                    rounded
                    lightShadow
                    px={17}
                    py={16}
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
                      <Box px={11} py={7} borderRadius={14} bg="lightPrimary">
                        <Text color="primary" bold fontSize={15}>
                          {formatRange(candidate.rangeStartVerse, candidate.rangeEndVerse)}
                        </Text>
                      </Box>
                      <Box ml={13} flex>
                        <Text bold fontSize={18} numberOfLines={2}>
                          {candidate.title ?? passage}
                        </Text>
                      </Box>
                      <FeatherIcon name="chevron-right" size={20} color="grey" />
                    </Box>
                    <Text mt={11} color="grey" fontSize={15} lineHeight={21} numberOfLines={4}>
                      {candidate.preview}
                    </Text>
                  </TouchableBox>
                )
              })}
            </Box>
          )}
        </ScrollView>
      )}
    </Box>
  )
}

export default CommentaryResourceTabScreen
